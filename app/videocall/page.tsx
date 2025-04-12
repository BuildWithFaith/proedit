"use client"
import PageSeo from "@/components/VideoCallSeo"
import { useEffect, useState, useRef, useCallback } from "react"
import { usePeer } from "@/contexts/PeerContext"
import type { MediaConnection } from "peerjs"
import ControlBar from "@/components/control-bar"
import BackgroundProcessor from "@/components/background-processor"
import { useCameraSwitch } from "@/hooks/use-camera-switch"
import toast from "react-hot-toast"
import { Loader2, Monitor, VideoIcon } from 'lucide-react'
// Import the useScreenShare hook at the top with other imports
import { useScreenShare } from "@/hooks/use-screen-share"

// Define custom interfaces for extended browser APIs
interface ExtendedRTCPeerConnection extends RTCPeerConnection {
  getDataChannels?: () => RTCDataChannel[]
  dataChannel?: RTCDataChannel
  dataChannels?: RTCDataChannel[]
}

interface ExtendedNavigator extends Navigator {
  scheduling?: {
    isInputPending?: () => boolean
  }
}

// Define this outside the component
function debounce(fn: Function, delay: number) {
  let timeoutId: NodeJS.Timeout | null = null;
  return function(...args: any[]) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export default function Home() {
  const { peer, connectedPeerId } = usePeer()
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [selectedBackground, setSelectedBackground] = useState("/background/livingroom.jpg")
  const [backgroundRemovalEnabled, setBackgroundRemovalEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [activeCall, setActiveCall] = useState<MediaConnection | null>(null)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "connected" | "ending">("idle")
  const [callDuration, setCallDuration] = useState(0)
  const [callStartTime, setCallStartTime] = useState<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Flag to track if background removal is in progress
  const [isBackgroundProcessing, setIsBackgroundProcessing] = useState(false)
  // Ref to store the processed stream
  const processedStreamRef = useRef<MediaStream | null>(null)
  // Ref to track if we need to update the remote stream
  const needsRemoteUpdateRef = useRef<boolean>(false)

  // Add these new state variables after the other state declarations (around line 30)
  const {
    isSharing: isScreenSharing,
    screenStream,
    startSharing: startScreenShareHook,
    stopSharing: stopScreenShareHook,
    error: screenShareError,
  } = useScreenShare({ keepAliveInBackground: true })
  const [previousStream, setPreviousStream] = useState<MediaStream | null>(null)
  const [isPageVisible, setIsPageVisible] = useState(true)
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Add this state variable after the other state declarations (around line 30)
  const [shouldMirror, setShouldMirror] = useState(false)
  // Replace the existing aspect ratio state variables with these optimized versions
  const [videoMetrics, setVideoMetrics] = useState<{
    localAspectRatio: number;
    remoteAspectRatio: number;
    isLocalPortrait: boolean;
    isRemotePortrait: boolean;
  }>({
    localAspectRatio: 16 / 9, // Default to 16:9
    remoteAspectRatio: 16 / 9,
    isLocalPortrait: false,
    isRemotePortrait: false
  })
  const [windowDimensions, setWindowDimensions] = useState<{
    width: number;
    height: number;
    isPortrait: boolean;
  }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    isPortrait: typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  })

  // Use the camera switch hook
  const {
    stream: cameraStream,
    switchCamera,
    hasMultipleCameras,
    currentCameraName,
    isInitialized,
    error: cameraError,
    startStream,
    devices,
    currentDeviceIndex,
  } = useCameraSwitch()

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)

  // Preload background images
  const preloadImages = useCallback((imagePaths: string[]) => {
    return Promise.all(
      imagePaths.map((path) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.src = path
          img.onload = () => {
            console.log(`✅ Preloaded: ${path}`)
            resolve(img)
          }
          img.onerror = () => {
            console.error(`❌ Failed to preload: ${path}`)
            reject(new Error(`Failed to load image: ${path}`))
          }
        })
      }),
    )
  }, [])

  // 1. Update the updateMirrorState function to be more reliable for front cameras
  const updateMirrorState = useCallback(() => {
    // Default to true for most common cases (laptops, mobile front cameras)
    let shouldMirrorValue = true

    // Only consider not mirroring if we have multiple cameras and can identify them
    if (hasMultipleCameras && devices && devices.length > 1 && currentDeviceIndex >= 0) {
      const currentDevice = devices[currentDeviceIndex]
      if (currentDevice && currentDevice.label) {
        const label = currentDevice.label.toLowerCase()
        // Only set to false if we're confident it's a back camera
        if (label.includes("back") || label.includes("rear") || label.includes("environment")) {
          shouldMirrorValue = false
          console.log("Detected back camera, disabling mirroring")
        } else {
          console.log("Detected front camera or unspecified camera, enabling mirroring")
        }
      }
    } else {
      console.log("Single camera device detected, enabling mirroring by default")
    }

    // Only update state if it's different to avoid unnecessary re-renders
    if (shouldMirror !== shouldMirrorValue) {
      console.log(`Setting mirror state to: ${shouldMirrorValue}`)
      setShouldMirror(shouldMirrorValue)
    }
  }, [currentDeviceIndex, hasMultipleCameras, devices, shouldMirror])

  // 2. Improve the mirrorVideoStream function to be more reliable
  const mirrorVideoStream = useCallback(
    (inputStream: MediaStream): Promise<MediaStream> => {
      // If mirroring is not needed, return the original stream
      if (!shouldMirror) {
        console.log("Mirroring not needed for this camera")
        return Promise.resolve(inputStream)
      }

      console.log("Creating mirrored stream")

      try {
        const videoElement = document.createElement("video")
        videoElement.srcObject = inputStream
        videoElement.autoplay = true
        videoElement.muted = true
        videoElement.playsInline = true

        const videoTrack = inputStream.getVideoTracks()[0]
        if (!videoTrack) {
          console.error("No video track found in stream to mirror")
          return Promise.resolve(inputStream)
        }

        const settings = videoTrack.getSettings()
        const width = settings.width || 640
        const height = settings.height || 480

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d", { alpha: false })

        if (!ctx) {
          console.error("Could not get canvas context")
          return Promise.resolve(inputStream)
        }

        // Disable image smoothing for pixel-perfect mirroring
        ctx.imageSmoothingEnabled = false

        return new Promise<MediaStream>((resolve) => {
          const mirroredStream = canvas.captureStream(30) // Use 30fps for smoother video

          // Add all audio tracks from the original stream
          inputStream.getAudioTracks().forEach((track) => {
            try {
              mirroredStream.addTrack(track)
            } catch (err) {
              console.error("Error adding audio track:", err)
            }
          })

          const drawFrame = () => {
            if (document.visibilityState === "visible" && videoElement.readyState >= 2) {
              ctx.save()
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              ctx.scale(-1, 1) // Mirror horizontally
              ctx.drawImage(videoElement, -canvas.width, 0, canvas.width, canvas.height)
              ctx.restore()
            }

            if (mirroredStream.active) {
              requestAnimationFrame(drawFrame)
            }
          }

          videoElement.onloadedmetadata = () => {
            videoElement
              .play()
              .then(() => {
                console.log("✅ Started mirroring stream successfully")
                // Start drawing frames
                drawFrame()
                resolve(mirroredStream)
              })
              .catch((err) => {
                console.error("Error playing video for mirroring:", err)
                resolve(inputStream) // Fallback to original stream
              })
          }

          // Fallback if metadata doesn't load within 1 second
          setTimeout(() => {
            if (!videoElement.readyState) {
              console.warn("Video metadata loading timeout, using original stream")
              resolve(inputStream)
            }
          }, 1000)
        })
      } catch (err) {
        console.error("Error in mirrorVideoStream:", err)
        return Promise.resolve(inputStream)
      }
    },
    [shouldMirror],
  )

  // Define updateRemoteStream before it's used
  const updateRemoteStream = useCallback(
    async (newStream: MediaStream) => {
      if (activeCall && activeCall.peerConnection) {
        try {
          const senders = activeCall.peerConnection.getSenders()
          const videoSender = senders.find((sender) => sender.track && sender.track.kind === "video")

          if (videoSender) {
            const videoTrack = newStream.getVideoTracks()[0]
            if (videoTrack) {
              await videoSender.replaceTrack(videoTrack)
              console.log("✅ Updated remote video stream")
            } else {
              console.warn("No video track available in the new stream")
            }
          } else {
            console.warn("No video sender found to update")
          }

          const audioSender = senders.find((sender) => sender.track && sender.track.kind === "audio")
          if (audioSender) {
            const audioTrack = newStream.getAudioTracks()[0]
            if (audioTrack) {
              await audioSender.replaceTrack(audioTrack)
              console.log("✅ Updated remote audio stream")
            } else {
              console.warn("No audio track available in the new stream")
            }
          } else {
            console.warn("No audio sender found to update")
          }
        } catch (error) {
          console.error("Error updating remote stream:", error)
        }
      }
    },
    [activeCall],
  )

  // 3. Create a new function to process the camera stream for both local display and remote sending
  const processCameraStream = useCallback(
    async (stream: MediaStream): Promise<MediaStream> => {
      if (!stream) return stream

      try {
        // Apply mirroring if needed
        const processedStream = shouldMirror ? await mirrorVideoStream(stream) : stream

        // Store the processed stream for later use
        if (shouldMirror) {
          console.log("Using mirrored stream for both local display and remote sending")
        }

        return processedStream
      } catch (error) {
        console.error("Error processing camera stream:", error)
        return stream // Fallback to original stream
      }
    },
    [shouldMirror, mirrorVideoStream],
  )

  // Pre-process the stream with mirroring if needed before passing to background removal
  const prepareStreamForBackgroundRemoval = useCallback(
    async (stream: MediaStream): Promise<MediaStream> => {
      // If mirroring is needed, apply it before background removal
      if (shouldMirror) {
        console.log("Applying mirroring before background removal")
        return await mirrorVideoStream(stream)
      }
      return stream
    },
    [shouldMirror, mirrorVideoStream],
  )

  // Define stopScreenShare before it's used in any useEffect
  const stopScreenShare = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log("Stopping screen sharing...")

      // Stop screen sharing using the hook
      stopScreenShareHook()

      // Restore the previous stream if available
      if (previousStream) {
        setLocalStream(previousStream)

        // Process the stream for remote sending
        const processedStream = await processCameraStream(previousStream)

        // Update the local video display with the original stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = previousStream
          localVideoRef.current.style.display = "block"
          // CSS mirroring is applied via className
        }

        // Update the remote stream with the processed stream
        await updateRemoteStream(processedStream)
      } else if (cameraStream) {
        // Fallback to camera stream if previous stream is not available
        setLocalStream(cameraStream)

        // Process the stream for remote sending
        const processedStream = await processCameraStream(cameraStream)

        // Update the local video display with the original stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = cameraStream
          localVideoRef.current.style.display = "block"
          // CSS mirroring is applied via className
        }

        // Update the remote stream with the processed stream
        await updateRemoteStream(processedStream)
      }

      // Reset state
      setPreviousStream(null)

      // Clear keep-alive interval if it exists
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current)
        keepAliveIntervalRef.current = null
      }

      // Remove screen sharing class
      document.body.classList.remove("screen-sharing-active")

      // Restore original document title
      if (document.body.dataset.originalTitle) {
        document.title = document.body.dataset.originalTitle
        delete document.body.dataset.originalTitle
      }

      setIsLoading(false)

      toast.success("Screen Sharing Stopped\nReturned to camera view")
    } catch (error) {
      console.error("Error stopping screen share:", error)
      setIsLoading(false)
      toast.error("Failed to stop screen sharing",
      )
    }
  }, [cameraStream, previousStream, processCameraStream, stopScreenShareHook, updateRemoteStream, toast])

  // Replace the existing startScreenShare function with this improved version
  const startScreenShare = useCallback(async () => {
    if (!activeCall || !activeCall.peerConnection) {
      toast.error("No Active Call\nYou must be in a call to share your screen")
      return
    }

    try {
      setIsLoading(true)
      console.log("Starting screen sharing with worker-based keep-alive...")

      // Save the current stream to restore later
      setPreviousStream(localStream)

      // Start screen sharing using the hook
      const stream = await startScreenShareHook().catch((error) => {
        console.error("Error in startScreenShareHook:", error)
        // Check for common errors
        if (error.name === "NotAllowedError" || error.message?.includes("Permission")) {
          toast.error("Permission Denied\nYou denied permission to share your screen")
        } else {
          toast.error(`${error.message || "Failed to start screen sharing"} `)
        }
        return null
      })

      if (!stream) {
        throw new Error("Failed to get screen sharing stream")
      }

      // Add direct event listeners to the tracks for immediate response
      stream.getVideoTracks().forEach((track) => {
        track.onended = async () => {
          console.log("Screen share track ended directly")
          if (isScreenSharing) {
            await stopScreenShare()
          }
        }
      })

      // Update the local video display
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        localVideoRef.current.style.display = "none"
      }

      // Update the remote stream
      await updateRemoteStream(stream)

      // Set document title to indicate screen sharing is active
      const originalTitle = document.title
      document.title = "📺 Screen Sharing Active - " + originalTitle

      // Store original title to restore later
      document.body.dataset.originalTitle = originalTitle

      setIsLoading(false)
      toast.success("Screen Sharing Started\nYour screen is now being shared")

      // Add a class to indicate screen sharing is active
      document.body.classList.add("screen-sharing-active")

      return stream
    } catch (error) {
      console.error("Error starting screen share:", error)
      setIsLoading(false)
      toast.error("Failed to start screen sharing. Please try again.")
      return null
    }
  }, [activeCall, localStream, startScreenShareHook, stopScreenShare, toast, updateRemoteStream])

  // Define handleIncomingCall before it's used
  const handleIncomingCall = useCallback(
    (call: MediaConnection) => {
      console.log("📞 Incoming call from:", call.peer)
      setCallStatus("connecting")
      setIsLoading(true)

      // Answer the call with the current local stream
      if (localStream) {
        call.answer(localStream)
        setActiveCall(call) // Store the call reference

        call.on("stream", (incomingStream) => {
          console.log("🎬 Received Remote Stream:", incomingStream)
          setRemoteStream(incomingStream)
          setCallStatus("connected")
          setIsLoading(false)
        })

        call.on("close", () => {
          console.log("Call closed")
          setRemoteStream(null)
          setCallStatus("idle")
          setActiveCall(null)
        })

        call.on("error", (err) => {
          console.error("Call error:", err)
          setCallStatus("idle")
          setIsLoading(false)
          toast.error(`${err.message || "An error occurred during the call"}`)
        })
      } else {
        console.error("No local stream available to answer call")
        setCallStatus("idle")
        setIsLoading(false)
        toast.error("No camera stream available to answer the call")
      }
    },
    [localStream, toast],
  )

  // Update the handleBackgroundRemovalToggle function to use the state
  const handleBackgroundRemovalToggle = useCallback(
    (enabled: boolean | ((prev: boolean) => boolean)) => {
      // Convert function-style state updates to boolean
      const newEnabled = typeof enabled === "function" ? enabled(backgroundRemovalEnabled) : enabled

      // If already in the desired state or processing, do nothing
      if (backgroundRemovalEnabled === newEnabled || isBackgroundProcessing || isLoading) {
        return
      }

      console.log(`Background removal toggle: ${newEnabled ? "ON" : "OFF"}`)

      // Set loading state
      setIsLoading(true)
      setIsBackgroundProcessing(true)

      // Update the state immediately for UI feedback
      setBackgroundRemovalEnabled(newEnabled)

      // Use an async IIFE to handle the async operations
      ;(async () => {
        try {
          if (!newEnabled) {
            // Turning OFF background removal
            console.log("Turning OFF background removal")

            // Make sure we have a valid local stream before stopping background removal
            if (!localStream) {
              throw new Error("No camera stream available")
            }

            // Create a clone of the local stream to ensure we have a fresh stream
            const freshStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: localStream.getVideoTracks()[0]?.getSettings()?.deviceId
                  ? {
                      exact: localStream.getVideoTracks()[0].getSettings().deviceId,
                    }
                  : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: localStream.getAudioTracks().length > 0,
            })

            // Apply current audio mute state to the fresh stream
            if (freshStream.getAudioTracks().length > 0) {
              freshStream.getAudioTracks().forEach((track) => {
                track.enabled = !isAudioMuted
              })
            }

            // Apply current video enabled state to the fresh stream
            if (freshStream.getVideoTracks().length > 0) {
              freshStream.getVideoTracks().forEach((track) => {
                track.enabled = isVideoEnabled
              })
            }

            // Stop the rendering loop and clean up WebGL resources
            BackgroundProcessor.stopRendering()
            BackgroundProcessor.cleanup()

            // Clear the processed stream reference
            processedStreamRef.current = null

            // Set the local stream to the fresh stream
            setLocalStream(freshStream)

            // For local display: Use the original stream with CSS mirroring
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = freshStream
              console.log("Set video source to fresh stream")
              // CSS mirroring is applied via className
            }

            // For remote stream: Process with canvas-based mirroring
            const processedStream = await processCameraStream(freshStream)

            // If in a call, update the remote stream with the processed stream
            if (activeCall) {
              await updateRemoteStream(processedStream)
              needsRemoteUpdateRef.current = false
            }
          } else {
            // Turning ON background removal
            console.log("Turning ON background removal")

            if (!localStream) {
              throw new Error("No camera stream available")
            }

            // First, apply mirroring if needed before passing to background removal
            const preparedStream = await prepareStreamForBackgroundRemoval(localStream)

            // Process the stream with background removal
            const processedStream = await BackgroundProcessor.processStreamWithBackgroundRemoval({
              stream: preparedStream,
              selectedBackground,
              isAudioMuted,
              canvasRef,
              backgroundImageRef,
              setLocalStream: (stream) => {
                // Store the processed stream in the ref
                processedStreamRef.current = stream

                // Set the video source to the processed stream immediately
                if (localVideoRef.current) {
                  localVideoRef.current.srcObject = stream
                  console.log("Set video source to processed stream")
                }
              },
            })

            // Store the processed stream in the ref
            processedStreamRef.current = processedStream

            // If in a call, update the remote stream
            if (activeCall) {
              await updateRemoteStream(processedStream)
              needsRemoteUpdateRef.current = false
            }
          }
        } catch (error) {
          console.error("Error toggling background removal:", error)

          // If there was an error, revert to the previous state
          setBackgroundRemovalEnabled(!newEnabled)

          // Show error toast
          toast.error("Failed to toggle background removal. Please try again")

          // Clean up if needed
          if (newEnabled) {
            BackgroundProcessor.stopRendering()
            BackgroundProcessor.cleanup()
            processedStreamRef.current = null

            // Make sure we restore the raw stream to the video element
            if (localVideoRef.current && localStream) {
              // Process the stream for display
              const processedStream = await processCameraStream(localStream)
              localVideoRef.current.srcObject = processedStream
            }
          }
        } finally {
          // Clear loading states
          setIsLoading(false)
          setIsBackgroundProcessing(false)
        }
      })()
    },
    [
      backgroundRemovalEnabled,
      isBackgroundProcessing,
      isLoading,
      localStream,
      isAudioMuted,
      isVideoEnabled,
      selectedBackground,
      activeCall,
      toast,
      updateRemoteStream,
      prepareStreamForBackgroundRemoval,
      processCameraStream,
    ],
  )

  // 5. Update the handleSwitchCamera function to ensure mirroring is applied correctly
  const handleSwitchCamera = useCallback(async () => {
    if (!hasMultipleCameras) return

    setIsLoading(true)
    try {
      // Use the hook's switchCamera function which handles all the device switching logic
      const newStream = await switchCamera(true)

      if (newStream) {
        // Update the mirror state based on the new camera
        // This needs to happen after the camera switch is complete
        setTimeout(() => {
          updateMirrorState()

          // Process the new stream with the updated mirror state
          ;(async () => {
            if (!backgroundRemovalEnabled) {
              // For remote stream: Process with canvas-based mirroring
              const processedStream = await processCameraStream(newStream)

              // For local display: Use the original stream with CSS mirroring
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = newStream
                // CSS mirroring is applied via className
              }

              // If we're in a call, update the remote stream
              if (activeCall) {
                await updateRemoteStream(processedStream)
              }
            }
          })()
        }, 200) // Slightly longer delay to ensure camera info is updated

        toast.success(`Camera Switched to ${currentCameraName}`)

        // If background removal is enabled, we need to reprocess the stream
        if (backgroundRemovalEnabled) {
          // Turn off background removal first
          await handleBackgroundRemovalToggle(false)

          // Then turn it back on with the new stream
          setTimeout(() => {
            handleBackgroundRemovalToggle(true)
            setIsLoading(false)
          }, 500)
        } else {
          setIsLoading(false)
        }
      } else {
        throw new Error("Failed to switch camera")
      }
    } catch (err) {
      console.error("Error switching camera:", err)
      toast("Failed to switch camera. Please try again.")
      setIsLoading(false)
    }
  }, [
    hasMultipleCameras, 
    switchCamera, 
    updateMirrorState, 
    backgroundRemovalEnabled, 
    processCameraStream, 
    activeCall, 
    updateRemoteStream, 
    currentCameraName, 
    toast, 
    handleBackgroundRemovalToggle
  ])

  // Start/End call functions
  const startCall = useCallback(async () => {
    if (!peer) {
      toast.loading("Peer connection not initialized. Please refresh the page and try again.")
      return
    }

    if (!connectedPeerId) {
      toast.loading("No peer connected. Please connect to a peer first.")
      return
    }

    setCallStatus("connecting")
    setIsLoading(true)

    try {
      // Make sure we have a valid local stream
      let streamToUse = localStream

      // If we don't have a local stream yet, try to get one using the hook's startStream
      if (!streamToUse && startStream) {
        console.log("No local stream available, attempting to create one...")
        const currentDevice = devices && devices.length > 0 ? devices[currentDeviceIndex]?.deviceId : undefined
        streamToUse = await startStream(currentDevice || "", true)

        if (streamToUse) {
          console.log("Successfully created stream for outgoing call")
          setLocalStream(streamToUse)
        } else {
          throw new Error("Failed to create camera stream for outgoing call")
        }
      }

      if (!streamToUse) {
        throw new Error("No camera stream available")
      }

      // Process the stream for both local display and remote sending
      let finalStream
      if (backgroundRemovalEnabled && processedStreamRef.current) {
        finalStream = processedStreamRef.current
      } else {
        // For remote stream: Process with canvas-based mirroring
        finalStream = await processCameraStream(streamToUse)

        // For local display: Use the original stream with CSS mirroring
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = streamToUse
          // CSS mirroring is applied via className
        }
      }

      // Log audio tracks
      const audioTracks = finalStream.getAudioTracks()
      console.log(`Audio tracks in outgoing stream: ${audioTracks.length}`)

      if (audioTracks.length > 0) {
        // Make sure audio state is correctly applied
        audioTracks[0].enabled = !isAudioMuted
        console.log(`Audio track enabled for call: ${!isAudioMuted}`)
      } else {
        console.warn("No audio tracks in outgoing stream!")
      }

      console.log("📞 Calling peer:", connectedPeerId)

      // Check if peer is still valid before making the call
      if (!peer || peer.destroyed) {
        throw new Error("Peer connection is no longer valid")
      }

      // Make the call with the processed stream
      const call = peer.call(connectedPeerId, finalStream)

      if (!call) {
        throw new Error("Failed to create call object")
      }

      setActiveCall(call) // Store the call reference

      // Set up event listeners
      call.on("stream", (incomingStream) => {
        console.log("🎬 Received Remote Stream:", incomingStream)

        // Log audio tracks in incoming stream
        const incomingAudioTracks = incomingStream.getAudioTracks()
        console.log(`Incoming stream audio tracks: ${incomingAudioTracks.length}`)

        // Log video tracks in incoming stream
        const incomingVideoTracks = incomingStream.getVideoTracks()
        console.log(`Incoming stream video tracks: ${incomingVideoTracks.length}`)

        if (incomingVideoTracks.length === 0) {
          console.warn("No video tracks in incoming stream!")
        }

        setRemoteStream(incomingStream)
        setCallStatus("connected")
        setIsLoading(false)
      })

      call.on("error", (err) => {
        console.error("Call error:", err)
        setCallStatus("idle")
        setIsLoading(false)
        toast.error(`${err.message || "An error occurred during the call"}`)
      })

      call.on("close", () => {
        console.log("Call closed")
        setRemoteStream(null)
        setCallStatus("idle")
      })

      // Set a timeout in case the call doesn't connect
      const timeout = setTimeout(() => {
        if (callStatus === "connecting") {
          console.log("Call timed out")
          call.close()
          setCallStatus("idle")
          setIsLoading(false)
          toast.loading("The call took too long to connect. Please try again.")
        }
      }, 30000) // 30 second timeout

      // Clear the timeout if the component unmounts or the call connects
      return () => clearTimeout(timeout)
    } catch (error: any) {
      console.error("Error starting call:", error)
      setCallStatus("idle")
      setIsLoading(false)
      toast.error(`${error.message || "Failed to start call. Please check your camera and microphone."}`)
    }
  }, [
    peer, 
    connectedPeerId, 
    localStream, 
    startStream, 
    devices, 
    currentDeviceIndex, 
    backgroundRemovalEnabled, 
    processCameraStream, 
    isAudioMuted, 
    callStatus, 
    toast
  ])

  // End a call
  const endCall = useCallback(() => {
    console.log("📞 Ending call...")
    setCallStatus("ending")
    setIsLoading(true)

    // First, stop the background processor rendering loop
    if (backgroundRemovalEnabled) {
      BackgroundProcessor.stopRendering()
    }

    // Close the active call
    if (activeCall) {
      try {
        activeCall.close()
      } catch (e) {
        console.error("Error closing active call:", e)
      }
    }
    setActiveCall(null)

    // Add this to the endCall function, right after the "Close the active call" section
    // Stop screen sharing if active when call ends
    if (isScreenSharing && screenStream) {
      stopScreenShareHook()
      setPreviousStream(null)
    }

    // Get references to all connections
    const currentPeer = peer
    const currentLocalVideo = localVideoRef.current
    const currentRemoteVideo = remoteVideoRef.current
    const currentCanvas = canvasRef.current

    // Close all media connections specifically
    if (currentPeer) {
      try {
        // Properly close each media connection
        Object.values(currentPeer.connections).forEach((connections) => {
          connections.forEach((conn: any) => {
            console.log("Closing connection:", conn)
            if (conn.type === "media" && conn.close) {
              conn.close()
            }
            if (conn.peerConnection) {
              conn.peerConnection.close()
            }
          })
        })
      } catch (e) {
        console.error("Error closing peer connections:", e)
      }
    }

    // Stop all media tracks from all possible sources
    const stopAllTracksFromStream = (stream: MediaStream | null) => {
      if (!stream) return
      console.log("Stopping tracks for stream:", stream.id)
      stream.getTracks().forEach((track) => {
        console.log("Stopping track:", track.id, track.kind)
        track.stop()
      })
    }

    // Stop local video stream
    if (currentLocalVideo?.srcObject) {
      stopAllTracksFromStream(currentLocalVideo.srcObject as MediaStream)
      currentLocalVideo.srcObject = null
      console.log("✅ Local video stream cleared")
    }

    // Stop remote video stream
    if (currentRemoteVideo?.srcObject) {
      stopAllTracksFromStream(currentRemoteVideo.srcObject as MediaStream)
      currentRemoteVideo.srcObject = null
      console.log("✅ Remote video stream cleared")
    }

    // Stop canvas stream
    if (backgroundRemovalEnabled && currentCanvas) {
      try {
        const canvasStream = currentCanvas.captureStream()
        stopAllTracksFromStream(canvasStream)
        console.log("✅ Canvas stream stopped")
      } catch (e) {
        console.error("Error stopping canvas stream:", e)
      }
    }

    // Reset global state
    setRemoteStream(null)

    // Clean up WebGL resources if background removal was enabled
    if (backgroundRemovalEnabled) {
      BackgroundProcessor.cleanup()
      processedStreamRef.current = null
    }

    setIsAudioMuted(false)
    setIsVideoEnabled(true)
    setCallStatus("idle")
    setIsLoading(false)

    console.log("✅ Call ended successfully")
  }, [
    backgroundRemovalEnabled, 
    activeCall, 
    isScreenSharing, 
    screenStream, 
    stopScreenShareHook, 
    peer, 
    localVideoRef, 
    remoteVideoRef, 
    canvasRef
  ])

  // Toggle audio mute state
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = isAudioMuted
      })

      // Also update audio in the active call if it exists
      if (activeCall && activeCall.peerConnection) {
        const senders = activeCall.peerConnection.getSenders()
        const audioSender = senders.find((sender) => sender.track && sender.track.kind === "audio")

        if (audioSender && audioSender.track) {
          audioSender.track.enabled = isAudioMuted
        }
      }

      // Also update audio in the processed stream if it exists
      if (processedStreamRef.current) {
        const processedAudioTracks = processedStreamRef.current.getAudioTracks()
        processedAudioTracks.forEach((track) => {
          track.enabled = isAudioMuted
        })
      }

      setIsAudioMuted(!isAudioMuted)
      console.log(`🎤 Audio ${isAudioMuted ? "unmuted" : "muted"}`)
    }
  }, [localStream, isAudioMuted, activeCall])

  // Toggle video enabled state
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks()
      videoTracks.forEach((track) => {
        track.enabled = !isVideoEnabled
      })

      // Also update video in the processed stream if it exists
      if (processedStreamRef.current) {
        const processedVideoTracks = processedStreamRef.current.getVideoTracks()
        processedVideoTracks.forEach((track) => {
          track.enabled = !isVideoEnabled
        })
      }

      setIsVideoEnabled(!isVideoEnabled)
      console.log(`📹 Video ${isVideoEnabled ? "disabled" : "enabled"}`)
    }
  }, [localStream, isVideoEnabled])

  // Replace the getObjectFit function with this memoized and optimized version
  const getObjectFit = useCallback((isLocalVideo: boolean = false) => {
    // For screen sharing, always use contain to show the entire screen
    if (isScreenSharing) return "contain";
    
    const {
      localAspectRatio,
      remoteAspectRatio,
      isLocalPortrait,
      isRemotePortrait
    } = videoMetrics;
    
    const { isPortrait: isDevicePortrait } = windowDimensions;
    
    // For local video (PiP)
    if (isLocalVideo) {
      // If background removal is enabled, always use cover
      if (backgroundRemovalEnabled) return "cover";
      
      // If it's a selfie camera (mirrored), prioritize seeing your face
      if (shouldMirror) return "cover";
      
      // For back cameras or non-mirrored views, adapt based on aspect ratio
      // If video and device have matching orientations, use cover
      if ((isLocalPortrait && isDevicePortrait) || (!isLocalPortrait && !isDevicePortrait)) {
        return "cover";
      }
      // If orientations don't match, use contain to see everything
      return "contain";
    }
    
    // For remote video (main view)
    // If video and device have matching orientations, use cover for a more immersive experience
    if ((isRemotePortrait && isDevicePortrait) || (!isRemotePortrait && !isDevicePortrait)) {
      return "cover";
    }
    
    // If video is landscape but device is portrait
    if (!isRemotePortrait && isDevicePortrait) {
      // For very wide videos (like 21:9 or wider), use contain to avoid excessive cropping
      return remoteAspectRatio > 2.1 ? "contain" : "cover";
    }
    
    // If video is portrait but device is landscape
    if (isRemotePortrait && !isDevicePortrait) {
      // For very tall videos, use contain
      return remoteAspectRatio < 0.5 ? "contain" : "cover";
    }
    
    // Default fallback
    return "cover";
  }, [videoMetrics, windowDimensions, isScreenSharing, backgroundRemovalEnabled, shouldMirror]);

  // Update the useEffect that initializes mirroring state to run on component mount
  useEffect(() => {
    // Set initial mirror state when component mounts or camera changes
    updateMirrorState()
  }, [updateMirrorState])

  // 4. Update the useEffect that handles camera stream changes to use CSS mirroring for local display
  useEffect(() => {
    if (cameraStream) {
      // Apply current audio mute state
      const audioTracks = cameraStream.getAudioTracks()
      if (audioTracks.length > 0) {
        audioTracks.forEach((track) => {
          track.enabled = !isAudioMuted
        })
      }

      // Apply current video enabled state
      const videoTracks = cameraStream.getVideoTracks()
      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => {
          track.enabled = isVideoEnabled
        })
      }

      // Set the local stream
      setLocalStream(cameraStream)

      // Process the stream for both local display and remote sending
      ;(async () => {
        if (!backgroundRemovalEnabled) {
          // For remote stream: Process with canvas-based mirroring
          const processedStream = await processCameraStream(cameraStream)

          // For local display: Use the original stream with CSS mirroring
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = cameraStream
            // CSS mirroring is applied via className
          }

          // If we're in a call, update the remote stream with the processed stream
          if (activeCall) {
            await updateRemoteStream(processedStream)
          }
        }
      })()
    }
  }, [
    cameraStream,
    isAudioMuted,
    isVideoEnabled,
    activeCall,
    backgroundRemovalEnabled,
    updateRemoteStream,
    processCameraStream,
  ])

  // Show toast if camera error occurs
  useEffect(() => {
    if (cameraError) {
      toast.error(`Camera Error: ${cameraError}`)
    }
  }, [cameraError, toast])

  // Preload background images when the app starts
  useEffect(() => {
    preloadImages([
      "/background/livingroom.jpg",
      "/background/livingroom2.jpg",
      "/background/livingroom3.jpg",
      "/background/office.jpg",
    ]).then(() => console.log("✅ All backgrounds preloaded!"))
  }, [preloadImages])

  // Set remote video source when remote stream changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Handle call timer
  useEffect(() => {
    if (callStatus === "connected" && !callStartTime) {
      const startTime = Date.now() // Fresh timestamp
      setCallStartTime(startTime)

      timerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTime) / 1000)) // Use fresh timestamp
      }, 1000)
    } else if (callStatus !== "connected") {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setCallStartTime(null)
      setCallDuration(0)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [callStatus]) // Remove callStartTime from dependencies

  // Update the useEffect that handles incoming calls to use our memoized handleIncomingCall function
  useEffect(() => {
    if (!peer) return

    peer.on("call", handleIncomingCall)

    return () => {
      peer.off("call", handleIncomingCall)
    }
  }, [peer, handleIncomingCall]) // Simplified dependency array since handleIncomingCall is now memoized

  // Load background image when selected
  useEffect(() => {
    // Preload the selected background
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = selectedBackground
    img.onload = () => {
      backgroundImageRef.current = img
      console.log(`✅ Background loaded: ${selectedBackground}`)

      // If background removal is already enabled, we need to reprocess with the new background
      if (backgroundRemovalEnabled && localStream) {
        // Flag that we need to update
        needsRemoteUpdateRef.current = true

        // Process with new background
        ;(async () => {
          try {
            setIsLoading(true)

            // First, apply mirroring if needed before passing to background removal
            const preparedStream = await prepareStreamForBackgroundRemoval(localStream)

            const processedStream = await BackgroundProcessor.processStreamWithBackgroundRemoval({
              stream: preparedStream,
              selectedBackground,
              isAudioMuted,
              canvasRef,
              backgroundImageRef,
              setLocalStream: (stream) => {
                processedStreamRef.current = stream

                // Update the video source immediately
                if (localVideoRef.current) {
                  localVideoRef.current.srcObject = stream
                }
              },
            })

            // If in a call, update the remote stream
            if (activeCall) {
              await updateRemoteStream(processedStream)
              needsRemoteUpdateRef.current = false
            }
          } catch (error) {
            console.error("Error updating background:", error)
            toast.error("Failed to update background. Please try again.")
          } finally {
            setIsLoading(false)
          }
        })()
      }
    }
  }, [
    selectedBackground,
    backgroundRemovalEnabled,
    localStream,
    isAudioMuted,
    activeCall,
    toast,
    updateRemoteStream,
    prepareStreamForBackgroundRemoval,
  ])

  // Replace the existing useEffect for handling orientation changes with this optimized version
  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isPortrait = height > width;
      
      setWindowDimensions(prev => {
        // Only update if values have changed to prevent unnecessary re-renders
        if (prev.width !== width || prev.height !== height || prev.isPortrait !== isPortrait) {
          return { width, height, isPortrait };
        }
        return prev;
      });
    };
    
    // Initial update
    updateDimensions();
    
    // Debounced resize handler to improve performance
    const debouncedUpdateDimensions = debounce(updateDimensions, 200);
    
    window.addEventListener("resize", debouncedUpdateDimensions);
    window.addEventListener("orientationchange", updateDimensions); // Immediate update on orientation change
    
    return () => {
      window.removeEventListener("resize", debouncedUpdateDimensions);
      window.removeEventListener("orientationchange", updateDimensions);
    };
  }, []);

  // Replace the existing useEffect for tracking video track aspect ratio with this optimized version
  useEffect(() => {
    const updateVideoMetrics = () => {
      if (!localStream && !remoteStream) return;
      
      const newMetrics = { ...videoMetrics };
      let hasChanges = false;
      
      // Update local stream metrics
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          if (settings.width && settings.height) {
            const aspectRatio = settings.width / settings.height;
            const isPortrait = settings.height > settings.width;
            
            if (newMetrics.localAspectRatio !== aspectRatio || newMetrics.isLocalPortrait !== isPortrait) {
              newMetrics.localAspectRatio = aspectRatio;
              newMetrics.isLocalPortrait = isPortrait;
              hasChanges = true;
            }
          }
        }
      }
      
      // Update remote stream metrics
      if (remoteStream) {
        const videoTrack = remoteStream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          if (settings.width && settings.height) {
            const aspectRatio = settings.width / settings.height;
            const isPortrait = settings.height > settings.width;
            
            if (newMetrics.remoteAspectRatio !== aspectRatio || newMetrics.isRemotePortrait !== isPortrait) {
              newMetrics.remoteAspectRatio = aspectRatio;
              newMetrics.isRemotePortrait = isPortrait;
              hasChanges = true;
            }
          }
        }
      }
      
      // Only update state if there are actual changes
      if (hasChanges) {
        setVideoMetrics(newMetrics);
      }
    };
    
    // Update metrics immediately
    updateVideoMetrics();
    
    // Set up interval to periodically check for changes (some browsers don't reliably fire events)
    const intervalId = setInterval(updateVideoMetrics, 2000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [localStream, remoteStream, videoMetrics]);

  // Add this new useEffect after the other useEffects to handle page visibility
  useEffect(() => {
    // Function to handle visibility change
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible"
      setIsPageVisible(isVisible)

      // If we're screen sharing and the page becomes hidden
      if (!isVisible && isScreenSharing) {
        console.log("Page hidden while screen sharing - activating keep-alive")

        // Add class to body to indicate hidden screen sharing
        document.body.classList.add("hidden-screen-sharing")

        // Set up a keep-alive interval to prevent the stream from freezing
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current)
        }

        keepAliveIntervalRef.current = setInterval(() => {
          // Send a small data message to keep the connection active
          if (activeCall && activeCall.peerConnection) {
            try {
              // Try to access data channels in a more compatible way
              let dataChannel = null
              if (activeCall.peerConnection) {
                // Cast to our extended interface
                const peerConn = activeCall.peerConnection as ExtendedRTCPeerConnection

                // Try different methods to access data channels
                if (typeof peerConn.getDataChannels === "function") {
                  const channels = peerConn.getDataChannels()
                  if (channels && channels.length > 0) {
                    dataChannel = channels[0]
                  }
                } else if (peerConn.dataChannel) {
                  dataChannel = peerConn.dataChannel
                } else if (peerConn.dataChannels) {
                  const channels = peerConn.dataChannels
                  if (channels && channels.length > 0) {
                    dataChannel = channels[0]
                  }
                }

                // Send keepalive if we have a data channel
                if (dataChannel && dataChannel.readyState === "open") {
                  dataChannel.send(JSON.stringify({ type: "keepalive", timestamp: Date.now() }))
                }
              }

              // Log connection status periodically
              console.log("Keep-alive: Screen sharing active while page hidden")
            } catch (e) {
              console.error("Error in keep-alive:", e)
            }
          }
        }, 1000) // Send a keep-alive signal every second

        // Request the browser to prioritize this page even when hidden
        const extendedNav = navigator as ExtendedNavigator
        if (extendedNav.scheduling && typeof extendedNav.scheduling.isInputPending === "function") {
          document.body.classList.add("screen-sharing-active")
        }

        // Optimize performance during screen sharing
        if (isScreenSharing) {
          // Request high performance mode from the browser
          if (typeof window.requestIdleCallback === "function") {
            // Lower the priority of non-essential tasks
            const lowPriorityTasks = () => {
              // Any non-essential animations or calculations can go here
              console.log("Running low priority tasks during screen sharing")
            }

            // Schedule low priority tasks for idle time
            window.requestIdleCallback(lowPriorityTasks, { timeout: 1000 })
          }

          // Add a class to the body to optimize rendering
          document.body.classList.add("screen-sharing-active")
        }
      } else if (isVisible) {
        // Remove the hidden screen sharing class
        document.body.classList.remove("hidden-screen-sharing")

        // Clear the keep-alive interval when the page becomes visible again
        console.log("Page visible again - deactivating keep-alive")
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current)
          keepAliveIntervalRef.current = null
        }
        document.body.classList.remove("screen-sharing-active")
      }
    }

    // Set up event listeners for page visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Clean up
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current)
        keepAliveIntervalRef.current = null
      }

      document.body.classList.remove("screen-sharing-active")
      document.body.classList.remove("hidden-screen-sharing")

      // Add the missing cleanup code here
      if (document.body.dataset.originalTitle) {
        document.title = document.body.dataset.originalTitle
        delete document.body.dataset.originalTitle
      }
    }
  }, [isScreenSharing, activeCall])

  // Add a useEffect to handle screen share errors
  useEffect(() => {
    if (screenShareError) {
      toast.error(`Screen Sharing Error
        ${screenShareError}`)
    }
  }, [screenShareError, toast])

  // Add this useEffect to handle screen sharing track ended events (when user clicks Chrome's native "Stop sharing" button)
  useEffect(() => {
    // Only set up listeners if we're actively screen sharing
    if (isScreenSharing && screenStream) {
      console.log("Setting up screen share track ended listeners")

      // Add ended event listeners to all video tracks
      const videoTracks = screenStream.getVideoTracks()

      const handleTrackEnded = async () => {
        console.log("Screen sharing track ended via browser controls")

        // Only handle if we're still in screen sharing state
        if (isScreenSharing) {
          toast.success("Screen sharing stopped from browser controls")

          // Call our stopScreenShare function to properly clean up
          await stopScreenShare()
        }
      }

      // Add listeners to all video tracks
      videoTracks.forEach((track) => {
        track.addEventListener("ended", handleTrackEnded)
      })

      // Clean up listeners when component unmounts or screen sharing state changes
      return () => {
        videoTracks.forEach((track) => {
          track.removeEventListener("ended", handleTrackEnded)
        })
      }
    }
  }, [isScreenSharing, screenStream, toast, stopScreenShare])

  // Format call duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Show loading state while camera is initializing
  if (!isInitialized) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 shadow-lg text-center">
          <div className="mx-auto flex justify-center mb-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          </div>
          <p className="text-gray-700 font-medium">Initializing camera and mic...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageSeo />

      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4">
        <div className="relative w-full max-w-5xl flex justify-center aspect-[9/16] xl:aspect-video rounded-2xl backdrop-blur-sm border border-white/20 shadow-xl overflow-hidden">
          {/* Remote Video */}
          {remoteStream ? (
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full aspect-video" 
              style={{ objectFit: getObjectFit() }}
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                if (video.videoWidth && video.videoHeight) {
                  const aspectRatio = video.videoWidth / video.videoHeight;
                  const isPortrait = video.videoHeight > video.videoWidth;
                  
                  setVideoMetrics(prev => ({
                    ...prev,
                    remoteAspectRatio: aspectRatio,
                    isRemotePortrait: isPortrait
                  }));
                }
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full bg-white/10">
              <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-4 rounded-full bg-white">
                <VideoIcon className="w-8 h-8 text-black" />
              </div>
              <p className="text-white text-sm sm:text-base font-medium">Waiting for participant to join...</p>
            </div>
          )}

          {/* Local Video (PiP) */}
          {!isScreenSharing && (
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 w-28 sm:w-32 md:w-36 lg:w-40 xl:w-48 aspect-video rounded-lg overflow-hidden shadow-md">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full ${shouldMirror && !backgroundRemovalEnabled ? "scale-x-[-1]" : ""}`}
                style={{ objectFit: getObjectFit(true) }}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  if (video.videoWidth && video.videoHeight) {
                    const aspectRatio = video.videoWidth / video.videoHeight;
                    const isPortrait = video.videoHeight > video.videoWidth;
                    
                    setVideoMetrics(prev => ({
                      ...prev,
                      localAspectRatio: aspectRatio,
                      isLocalPortrait: isPortrait
                    }));
                  }
                }}
              />
              <div className="absolute inset-0 pointer-events-none">
                <span className="absolute bg-black/40 text-white px-1.5 py-0.5 rounded text-xs bottom-1 left-1">
                  You
                </span>
                {hasMultipleCameras && (
                  <span className="absolute top-1 right-1 bg-black/40 text-white text-xs px-1 rounded">
                    {currentCameraName}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Screen sharing indicator */}
          {isScreenSharing && (
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 bg-red-500/80 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center animate-pulse">
              <Monitor size={16} className="mr-1 sm:mr-2" />
              <span>Screen Sharing</span>
            </div>
          )}

          {/* Call Info */}
          {remoteStream && (
            <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-black/50 text-white text-xs py-0.5 px-2 sm:py-1 sm:px-3 rounded-full flex items-center">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full mr-1.5"></div>
              <span>{formatDuration(callDuration)}</span>
            </div>
          )}

          {/* Call Controls */}
          <div className="absolute bottom-3 sm:bottom-5 left-1/2 transform -translate-x-1/2 flex items-center justify-center space-x-2 sm:space-x-4">
            <ControlBar
              remoteStream={remoteStream}
              startCall={startCall}
              endCall={endCall}
              isAudioMuted={isAudioMuted}
              toggleAudio={toggleAudio}
              isVideoEnabled={isVideoEnabled}
              toggleVideo={toggleVideo}
              backgroundRemovalEnabled={backgroundRemovalEnabled}
              setBackgroundRemovalEnabled={handleBackgroundRemovalToggle}
              selectedBackground={selectedBackground}
              setSelectedBackground={setSelectedBackground}
              isLoading={isLoading}
              callStatus={callStatus}
              hasMultipleCameras={hasMultipleCameras}
              switchCamera={handleSwitchCamera}
              currentCameraName={currentCameraName}
              isScreenSharing={isScreenSharing}
              startScreenShare={startScreenShare}
              stopScreenShare={stopScreenShare}
            />
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-lg text-center">
            <div className="mx-auto flex justify-center mb-4">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
            <p className="text-gray-700 font-medium">
              {callStatus === "connecting"
                ? "Establishing connection..."
                : callStatus === "ending"
                  ? "Ending call..."
                  : "Processing..."}
            </p>
          </div>
        </div>
      )}
    </>
  )
}