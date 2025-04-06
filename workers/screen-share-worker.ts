// This worker helps keep screen sharing active when the tab is in the background
// It runs in a separate thread that isn't throttled as much by the browser

// Set up the worker context with a unique name to avoid conflicts
const screenShareWorkerContext: Worker = self as any

// Track if we're actively keeping the stream alive
let isKeepingAlive = false
let keepAliveInterval: number | null = null

// Listen for messages from the main thread
screenShareWorkerContext.addEventListener("message", (event) => {
  const { type, payload } = event.data

  switch (type) {
    case "START_KEEP_ALIVE":
      startKeepAlive(payload?.intervalMs || 500)
      break

    case "STOP_KEEP_ALIVE":
      stopKeepAlive()
      break

    case "PING":
      // Respond immediately to pings to check if worker is responsive
      screenShareWorkerContext.postMessage({ type: "PONG", timestamp: Date.now() })
      break

    default:
      console.warn("Screen share worker: Unknown message type", type)
  }
})

// Start sending keep-alive signals at the specified interval
function startKeepAlive(intervalMs: number) {
  if (isKeepingAlive) {
    // Already running, just update the interval if different
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval)
    }
  }

  isKeepingAlive = true

  // Send initial status
  screenShareWorkerContext.postMessage({
    type: "STATUS",
    payload: {
      isActive: true,
      startedAt: Date.now(),
    },
  })

  // Set up interval to send keep-alive signals
  keepAliveInterval = setInterval(() => {
    // Send keep-alive signal to main thread
    screenShareWorkerContext.postMessage({
      type: "KEEP_ALIVE",
      payload: {
        timestamp: Date.now(),
        isActive: true,
      },
    })

    // Perform some minimal CPU work to keep the thread active
    // This helps prevent the browser from completely suspending the worker
    const startTime = Date.now()
    while (Date.now() - startTime < 5) {
      // Busy-wait for 5ms to ensure CPU activity
      // This minimal activity helps keep the worker prioritized
    }
  }, intervalMs) as unknown as number
}

// Stop sending keep-alive signals
function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }

  isKeepingAlive = false

  // Send status update
  screenShareWorkerContext.postMessage({
    type: "STATUS",
    payload: {
      isActive: false,
      stoppedAt: Date.now(),
    },
  })
}

// Notify that the worker is ready
screenShareWorkerContext.postMessage({ type: "READY" })

