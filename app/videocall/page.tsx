"use client"
import { useState, useEffect, useRef } from "react"
import { usePeer } from "@/contexts/PeerContext"
import type { MediaConnection } from "peerjs"
import VideoDisplay from "@/components/video-display"
import ControlBar from "@/components/control-bar"
import BackgroundProcessor from "@/components/background-processor"

export default function Home() {
  const { peer, peerId, connectedPeerId } = usePeer()
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [selectedBackground, setSelectedBackground] = useState("/background/office.avif")
  const [backgroundRemovalEnabled, setBackgroundRemovalEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [activeCall, setActiveCall] = useState<MediaConnection | null>(null)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)

  // Preload background images when the app starts
  useEffect(() => {
    preloadImages([
      "/background/office.avif",
      "/background/beach.jpg",
      "/background/city.jpg",
      "/background/mountains.avif",
    ]).then(() => console.log("✅ All backgrounds preloaded!"))
  }, [])

  // Set video sources when streams change
  useEffect(() => {
    // Set the local video source
    if (localVideoRef.current) {
      if (backgroundRemovalEnabled && canvasRef.current) {
        localVideoRef.current.srcObject = canvasRef.current.captureStream(30) || null
      } else if (localStream) {
        localVideoRef.current.srcObject = localStream
      }
    }

    // Set the remote video source
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream, localStream, backgroundRemovalEnabled])

  // Handle background removal toggle changes
  useEffect(() => {
    // Skip if no existing stream
    if (!localStream) return

    console.log("Background removal setting changed, updating streams...")

    // Stop current streams first
    const videoToStop = localVideoRef.current?.srcObject as MediaStream
    if (videoToStop) {
      videoToStop.getTracks().forEach((track) => track.stop())
    }

    // Get new processed stream with updated background removal setting
    getProcessedStream()
      .then((newStream) => {
        // If we have an active call, update its track
        if (activeCall) {
          updateRemoteStream(newStream)
        }
      })
      .catch((err) => {
        console.error("Error reinitializing stream after background toggle:", err)
      })
  }, [backgroundRemovalEnabled, selectedBackground, activeCall])

  // Handle incoming calls
  useEffect(() => {
    if (!peer) return

    const handleIncomingCall = async (incomingCall: MediaConnection) => {
      console.log("📞 Incoming call from:", incomingCall.peer)

      try {
        const processedStream = await getProcessedStream()
        console.log("🎥 Processed Stream for Auto-Answering:", processedStream)

        // Check if we have audio tracks
        const audioTracks = processedStream.getAudioTracks()
        console.log(`Audio tracks in processed stream: ${audioTracks.length}`)

        if (audioTracks.length > 0) {
          // Ensure audio track is enabled unless explicitly muted
          audioTracks[0].enabled = !isAudioMuted
          console.log(`Audio track enabled: ${!isAudioMuted}`)
        }

        incomingCall.answer(processedStream)
        setActiveCall(incomingCall) // Store the call reference
        console.log("✅ Auto-Answered the call")

        incomingCall.on("stream", (incomingStream: MediaStream) => {
          console.log("🎬 Receiving Remote Video Stream:", incomingStream)

          // Log audio tracks in incoming stream
          const incomingAudioTracks = incomingStream.getAudioTracks()
          console.log(`Incoming stream audio tracks: ${incomingAudioTracks.length}`)

          setRemoteStream(incomingStream)
        })

        incomingCall.on("close", () => {
          console.log("❌ Call Ended")
          setRemoteStream(null)
        })
      } catch (error) {
        console.error("Error handling incoming call:", error)
      }
    }

    peer.on("call", handleIncomingCall)

    return () => {
      peer.off("call", handleIncomingCall)
    }
  }, [peer, isAudioMuted])

  // Preload background images
  const preloadImages = (imagePaths: string[]) => {
    return Promise.all(
      imagePaths.map((path) => {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.src = path
          img.onload = () => {
            console.log(`✅ Preloaded: ${path}`)
            resolve(img)
          }
          img.onerror = () => {
            console.error(`❌ Failed to preload: ${path}`)
            reject(path)
          }
        })
      }),
    )
  }

  // Load background image when selected
  useEffect(() => {
    // Preload the selected background
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = selectedBackground
    img.onload = () => {
      backgroundImageRef.current = img
      console.log(`✅ Background loaded: ${selectedBackground}`)
    }
  }, [selectedBackground])

  // Get processed stream with or without background removal
  const getProcessedStream = async (): Promise<MediaStream> => {
    // Request user media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: true,
    })

    const originalAudioTrack = stream.getAudioTracks()[0]

    // If background removal is disabled, store and return the raw stream
    if (!backgroundRemovalEnabled) {
      setLocalStream(stream)

      // Apply current audio/video state
      if (isAudioMuted && stream) {
        const audioTracks = stream.getAudioTracks()
        audioTracks.forEach((track) => {
          track.enabled = !isAudioMuted
        })
      }

      return stream
    }

    // Process stream with background removal
    return await BackgroundProcessor.processStreamWithBackgroundRemoval({
      stream,
      selectedBackground,
      isAudioMuted,
      canvasRef,
      backgroundImageRef,
      setLocalStream,
    })
  }

  // Update remote stream when local stream changes
  const updateRemoteStream = async (newStream: MediaStream) => {
    if (!activeCall || !activeCall.peerConnection) {
      console.log("No active call to update")
      return
    }

    try {
      const videoTrack = newStream.getVideoTracks()[0]
      const audioTrack = newStream.getAudioTracks()[0]

      if (!videoTrack) {
        console.error("No video track in new stream")
        return
      }

      console.log("Replacing tracks in active connection")

      // Get all senders in the peer connection
      const senders = activeCall.peerConnection.getSenders()

      // Find the video sender and update it
      const videoSender = senders.find((sender) => sender.track && sender.track.kind === "video")

      if (videoSender) {
        // Replace the track
        await videoSender.replaceTrack(videoTrack)
        console.log("✅ Remote video track replaced successfully")
      } else {
        console.error("No video sender found in peer connection")
      }

      // Find and update audio sender if it exists and we have an audio track
      if (audioTrack) {
        const audioSender = senders.find((sender) => sender.track && sender.track.kind === "audio")

        if (audioSender) {
          await audioSender.replaceTrack(audioTrack)
          // Apply current mute state
          audioTrack.enabled = !isAudioMuted
          console.log("✅ Remote audio track replaced successfully")
        }
      }
    } catch (error) {
      console.error("Error updating remote stream:", error)
    }
  }

  // Start a call
  const startCall = async () => {
    if (!peer || !connectedPeerId) return

    try {
      const processedStream = await getProcessedStream()

      // Log audio tracks
      const audioTracks = processedStream.getAudioTracks()
      console.log(`Audio tracks in outgoing stream: ${audioTracks.length}`)

      if (audioTracks.length > 0) {
        // Make sure audio state is correctly applied
        audioTracks[0].enabled = !isAudioMuted
        console.log(`Audio track enabled for call: ${!isAudioMuted}`)
      } else {
        console.warn("No audio tracks in outgoing stream!")
      }

      console.log("🎥 Setting local video stream...")
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = processedStream
      }

      console.log("📞 Calling peer:", connectedPeerId)
      const call = peer.call(connectedPeerId, processedStream)
      setActiveCall(call) // Store the call reference

      call.on("stream", (incomingStream) => {
        console.log("🎬 Received Remote Stream:", incomingStream)

        // Log audio tracks in incoming stream
        const incomingAudioTracks = incomingStream.getAudioTracks()
        console.log(`Incoming stream audio tracks: ${incomingAudioTracks.length}`)

        setRemoteStream(incomingStream)
      })

      call.on("error", (err) => {
        console.error("Call error:", err)
      })

      call.on("close", () => {
        console.log("Call closed")
        setRemoteStream(null)
      })
    } catch (error) {
      console.error("Error starting call:", error)
    }
  }

  // End a call
  const endCall = () => {
    console.log("📞 Ending call...")

    // First, stop the background processor rendering loop
    if (backgroundRemovalEnabled) {
      BackgroundProcessor.stopRendering()
    }

    setActiveCall(null)

    // 1. Get references to all connections first
    const currentPeer = peer
    const currentLocalVideo = localVideoRef.current
    const currentRemoteVideo = remoteVideoRef.current
    const currentCanvas = canvasRef.current

    // 2. Close all media connections specifically
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

        // Remove all listeners to avoid memory leaks
        currentPeer.removeAllListeners()
      } catch (e) {
        console.error("Error closing peer connections:", e)
      }
    }

    // 3. Stop all media tracks from all possible sources
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

    // 4. Reset global state
    setRemoteStream(null)

    // 5. Clean up WebGL resources if background removal was enabled
    if (backgroundRemovalEnabled) {
      BackgroundProcessor.cleanup()
    }

    setIsAudioMuted(false)
    setIsVideoEnabled(true)

    console.log("✅ Call ended successfully")
  }

  // Toggle audio mute state
  const toggleAudio = () => {
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

      setIsAudioMuted(!isAudioMuted)
      console.log(`🎤 Audio ${isAudioMuted ? "unmuted" : "muted"}`)
    }
  }

  // Toggle video enabled state
  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks()
      videoTracks.forEach((track) => {
        track.enabled = !isVideoEnabled
      })
      setIsVideoEnabled(!isVideoEnabled)
      console.log(`📹 Video ${isVideoEnabled ? "disabled" : "enabled"}`)
    }
  }

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black transition-all duration-300 flex flex-col items-center justify-center text-white min-h-screen p-2 sm:p-4 md:p-6">
      {/* Status Bar */}
      <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-70 px-2 sm:px-4 py-2 sm:py-3 flex justify-between items-center z-10">
        <h1 className="text-lg sm:text-xl font-bold">Virtual Meeting</h1>
        <div className="flex items-center space-x-2">
          <div className="flex items-center">
            <div
              className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full mr-1 sm:mr-2 ${remoteStream ? "bg-green-500" : "bg-gray-500"}`}
            ></div>
            <span className="text-xs sm:text-sm">{remoteStream ? "Connected" : "Disconnected"}</span>
          </div>
          <div className="bg-black bg-opacity-40 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm">
            ID: {peerId?.substring(0, 6)}
          </div>
        </div>
      </div>

      {/* Video Display Component */}
      <VideoDisplay
        remoteStream={remoteStream}
        remoteVideoRef={remoteVideoRef}
        localVideoRef={localVideoRef}
        connectedPeerId={connectedPeerId}
        isVideoEnabled={isVideoEnabled}
      />

      {/* Control Bar Component */}
      <ControlBar
        remoteStream={remoteStream}
        startCall={startCall}
        endCall={endCall}
        isAudioMuted={isAudioMuted}
        toggleAudio={toggleAudio}
        isVideoEnabled={isVideoEnabled}
        toggleVideo={toggleVideo}
        backgroundRemovalEnabled={backgroundRemovalEnabled}
        setBackgroundRemovalEnabled={setBackgroundRemovalEnabled}
        selectedBackground={selectedBackground}
        setSelectedBackground={setSelectedBackground}
      />

      {/* Video Call Status Banner */}
      {remoteStream && (
        <div className="absolute top-14 sm:top-16 left-2 sm:left-4 right-2 sm:right-4 bg-green-600 bg-opacity-80 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-center shadow-lg flex items-center justify-center space-x-2 md:w-auto md:left-1/2 md:transform md:-translate-x-1/2">
          <div className="animate-pulse w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
          <p className="text-xs sm:text-sm font-medium">Call in progress</p>
        </div>
      )}

      {/* Current Background Display */}
      <div className="absolute top-14 sm:top-16 left-2 sm:left-4 px-2 sm:px-3 py-1 bg-black bg-opacity-60 rounded-lg text-xs sm:text-sm text-gray-300">
        {backgroundRemovalEnabled
          ? `Background: ${selectedBackground.split("/").pop()?.split(".")[0] || "default"}`
          : "Background removal: Off"}
      </div>
    </div>
  )
}

