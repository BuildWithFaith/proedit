"use client"
import { useState, useEffect, useRef } from "react"
import { usePeer } from "@/contexts/PeerContext"
import type { MediaConnection } from "peerjs"
import ControlBar from "@/components/control-bar"
import BackgroundProcessor from "@/components/background-processor"
import { ArrowLeft, MoreVertical, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const { peer, peerId, connectedPeerId, setConnectedPeerId } = usePeer()
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [selectedBackground, setSelectedBackground] = useState("/background/office.avif")
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

  // Handle call timer
  useEffect(() => {
    if (callStatus === "connected" && !callStartTime) {
      setCallStartTime(Date.now())

      timerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - (callStartTime || Date.now())) / 1000))
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
  }, [callStatus, callStartTime])

  // Format call duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Handle background removal toggle changes
  useEffect(() => {
    // Skip if no existing stream
    if (!localStream) return

    console.log("Background removal setting changed, updating streams...")
    setIsLoading(true)

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
        setIsLoading(false)
      })
      .catch((err) => {
        console.error("Error reinitializing stream after background toggle:", err)
        setIsLoading(false)
      })
  }, [backgroundRemovalEnabled, selectedBackground, activeCall])

  // Handle incoming calls
  useEffect(() => {
    if (!peer) return

    const handleIncomingCall = async (incomingCall: MediaConnection) => {
      console.log("📞 Incoming call from:", incomingCall.peer)
      setCallStatus("connecting")
      setIsLoading(true)

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
          setCallStatus("connected")
          setIsLoading(false)
        })

        incomingCall.on("close", () => {
          console.log("❌ Call Ended")
          setRemoteStream(null)
          setCallStatus("idle")
        })
      } catch (error) {
        console.error("Error handling incoming call:", error)
        setCallStatus("idle")
        setIsLoading(false)
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

    setCallStatus("connecting")
    setIsLoading(true)

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
        setCallStatus("connected")
        setIsLoading(false)
      })

      call.on("error", (err) => {
        console.error("Call error:", err)
        setCallStatus("idle")
        setIsLoading(false)
      })

      call.on("close", () => {
        console.log("Call closed")
        setRemoteStream(null)
        setCallStatus("idle")
      })
    } catch (error) {
      console.error("Error starting call:", error)
      setCallStatus("idle")
      setIsLoading(false)
    }
  }

  // End a call
  const endCall = () => {
    console.log("📞 Ending call...")
    setCallStatus("ending")
    setIsLoading(true)

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
    setCallStatus("idle")
    setIsLoading(false)

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
    <div className="bg-white min-h-screen flex flex-col">
      {/* Header
      <header className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-600 rounded-md flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6 text-white"
              >
                <path d="M4 6h16v12H4z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Business Video Call</h1>
              <p className="text-xs text-gray-500">March 24, 2025 | Virtual Meeting</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-gray-700 hover:text-gray-900 text-sm font-medium">
              Home
            </a>
            <a href="#" className="text-gray-700 hover:text-gray-900 text-sm font-medium">
              Agenda
            </a>
            <a href="#" className="text-gray-700 hover:text-gray-900 text-sm font-medium">
              Speakers
            </a>
            <a href="#" className="text-gray-700 hover:text-gray-900 text-sm font-medium">
              Companies
            </a>
            <a href="#" className="text-gray-700 hover:text-gray-900 text-sm font-medium">
              Participants
            </a>
            <a href="#" className="text-gray-700 hover:text-gray-900 text-sm font-medium">
              Marketplace
            </a>
          </nav>

          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-gray-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-gray-700"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <button className="p-2 rounded-full hover:bg-gray-100 relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-gray-700"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
              <img src="/placeholder.svg?height=32&width=32" alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header> */}

      {/* Main Content */}
      <main className="flex-1 py-4">
        <div className="container mx-auto px-4">

          {/* Video Container */}
          <div className="relative bg-white rounded-lg shadow-md overflow-hidden">
            {/* Remote Video */}
            <div className="w-full bg-zinc-100 relative">
              {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="w-[95vw] h-screen flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-gray-950 rounded-full flex items-center justify-center mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-10 h-10 text-white"
                    >
                      <path
                        strokeLinecap="round"
                        d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                  </div>
                  <p className="text-black font-medium">Waiting for participant to join...</p>
                </div>
              )}

              {/* Local Video (PiP) */}
              <div className="absolute top-4 left-4 w-36 lg:w-1/6 xl:w-44 aspect-[4/3] bg-white rounded-lg overflow-hidden shadow-md">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <span className="absolute flex justify-center w-full bottom-1  ">
                  <span className="bg-black bg-opacity-5 text-xs md:text-sm px-2 rounded">You</span>
                </span>
              </div>

              {/* Call Info */}
              {remoteStream && (
                <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white text-xs py-1 px-3 rounded-full flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span>{formatDuration(callDuration)}</span>
                </div>
              )}
            </div>

            {/* Call Controls */}
            <div className="py-3 px-4 flex items-center justify-center space-x-4 bg-transparent">
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
                isLoading={isLoading}
                callStatus={callStatus}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
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
    </div>
  )
}

