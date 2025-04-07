"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface ScreenShareOptions {
  keepAliveInBackground?: boolean
}

interface ScreenShareState {
  isInitialized: boolean
  isSharing: boolean
  error: string | null
}

export function useScreenShare(options: ScreenShareOptions = {}) {
  const [state, setState] = useState<ScreenShareState>({
    isInitialized: false,
    isSharing: false,
    error: null,
  })

  // Refs
  const screenStreamRef = useRef<MediaStream | null>(null)
  const screenShareWorkerRef = useRef<Worker | null>(null)

  // Stop screen sharing
  const stopSharing = useCallback(() => {
    // Clean up screen stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
    }

    // Update state
    setState((prev) => ({
      ...prev,
      isSharing: false,
    }))

    // Stop the worker's keep-alive if active
    if (screenShareWorkerRef.current) {
      screenShareWorkerRef.current.postMessage({
        type: "STOP_KEEP_ALIVE",
      })
    }
  }, [])

  // Start screen sharing
  const startSharing = useCallback(async () => {
    try {
      console.log("Starting screen sharing")

      // Stop any existing sharing
      stopSharing()

      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // Set to true if you want system audio
      })

      // Store the stream
      screenStreamRef.current = stream

      // Handle stream ending (user stops sharing)
      stream.getVideoTracks()[0].onended = () => {
        console.log("Screen sharing ended by user")
        stopSharing()
      }

      // Update state
      setState((prev) => ({
        ...prev,
        isSharing: true,
      }))

      return stream
    } catch (error) {
      console.error("Error starting screen sharing:", error)
      setState((prev) => ({
        ...prev,
        error: "Failed to start screen sharing",
        isSharing: false,
      }))
      return null
    }
  }, [stopSharing])

  // Initialize on mount
  useEffect(() => {
    if (typeof window === "undefined") return

    // Mark as initialized immediately
    setState((prev) => ({ ...prev, isInitialized: true }))

    // Initialize screen share worker if needed
    if (options.keepAliveInBackground) {
      try {
        screenShareWorkerRef.current = new Worker(new URL("@/workers/screen-share-worker.ts", import.meta.url), {
          type: "module",
        })

        // Listen for messages from the worker
        screenShareWorkerRef.current.onmessage = (event) => {
          const { type, payload } = event.data
          
          switch (type) {
            case "READY":
              console.log("Screen share worker is ready")
              break
              
            case "STATUS":
              console.log("Screen share worker status:", payload)
              break
              
            case "KEEP_ALIVE":
              // Worker is keeping the stream active
              break
              
            case "PONG":
              console.log("Worker responded to ping in", Date.now() - payload.timestamp, "ms")
              break
          }
        }
      } catch (error) {
        console.error("Failed to create screen share worker:", error)
      }
    }

    return () => {
      stopSharing()

      // Clean up screen share worker
      if (screenShareWorkerRef.current) {
        screenShareWorkerRef.current.terminate()
        screenShareWorkerRef.current = null
      }
    }
  }, [options.keepAliveInBackground, stopSharing])

  // Set up visibility change handler for background tab optimization
  useEffect(() => {
    if (!options.keepAliveInBackground || !screenShareWorkerRef.current) return

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible"

      if (!isVisible && state.isSharing) {
        // Page is hidden, start keep-alive
        screenShareWorkerRef.current?.postMessage({
          type: "START_KEEP_ALIVE",
          payload: { intervalMs: 500 },
        })
        console.log("Page hidden, starting keep-alive for screen share")
      } else if (isVisible) {
        // Page is visible again, stop keep-alive
        screenShareWorkerRef.current?.postMessage({
          type: "STOP_KEEP_ALIVE",
        })
        console.log("Page visible, stopping keep-alive for screen share")
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [options.keepAliveInBackground, state.isSharing])

  // Function to check if worker is responsive
  const pingWorker = useCallback(() => {
    if (!screenShareWorkerRef.current) return Promise.reject("Worker not initialized")
    
    return new Promise<number>((resolve) => {
      const startTime = Date.now()
      
      // Set up one-time listener for the pong
      const onMessage = (event: MessageEvent) => {
        if (event.data.type === "PONG") {
          screenShareWorkerRef.current?.removeEventListener("message", onMessage)
          resolve(Date.now() - startTime)
        }
      }
      if (screenShareWorkerRef.current){
      screenShareWorkerRef.current.addEventListener("message", onMessage)
      
      // Send ping
      screenShareWorkerRef.current.postMessage({
        type: "PING",
        timestamp: Date.now()
      })
    }
      
      // Set timeout to clean up listener
      setTimeout(() => {
        screenShareWorkerRef.current?.removeEventListener("message", onMessage)
        resolve(-1) // Timeout
      }, 1000)
    })
  }, [])

  return {
    ...state,
    startSharing,
    stopSharing,
    pingWorker,
    screenStream: screenStreamRef.current,
  }
}

