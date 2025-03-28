import * as bodyPix from "@tensorflow-models/body-pix"
import "@tensorflow/tfjs-backend-webgl"
import type { RefObject } from "react"

interface ProcessStreamOptions {
  stream: MediaStream
  selectedBackground: string
  isAudioMuted: boolean
  canvasRef: RefObject<HTMLCanvasElement | null>
  backgroundImageRef: RefObject<HTMLImageElement | null>
  setLocalStream: (stream: MediaStream) => void
}

// Static references for WebGL resources
let net: bodyPix.BodyPix | null = null
let glRef: WebGLRenderingContext | null = null
let videoElement: HTMLVideoElement | null = null
let videoTextureRef: WebGLTexture | null = null
let maskTextureRef: WebGLTexture | null = null
let programRef: WebGLProgram | null = null
// Animation frame ID for cancellation
let animationFrameId: number | null = null
// Flag to indicate if rendering should continue
let isRendering = false
// Buffer objects for reuse
let positionBuffer: WebGLBuffer | null = null
let texCoordBuffer: WebGLBuffer | null = null

// Fixed type definitions for shader locations
let locationRef = {
  position: -1,
  texCoord: -1,
}

// Separate ref for uniform locations with correct type
let uniformLocationsRef = {
  videoFrame: null as WebGLUniformLocation | null,
  mask: null as WebGLUniformLocation | null,
}

// Add a flag to track if the model is already loading
let isModelLoading = false

// Track the output canvas for reuse
let outputCanvasRef: HTMLCanvasElement | null = null
// Track the output stream for reuse
let outputStreamRef: MediaStream | null = null

const BackgroundProcessor = {
  // Process stream with background removal
  async processStreamWithBackgroundRemoval({
    stream,
    selectedBackground,
    isAudioMuted,
    canvasRef,
    backgroundImageRef,
    setLocalStream,
  }: ProcessStreamOptions): Promise<MediaStream> {
    console.log("Starting background removal process")

    // Clean up existing WebGL resources
    this.cleanupWebGL()

    // Set rendering flag to true
    isRendering = true

    const originalAudioTrack = stream.getAudioTracks()[0]

    // Set up video element for background removal processing
    videoElement = document.createElement("video")
    videoElement.srcObject = stream
    videoElement.autoplay = true
    videoElement.playsInline = true
    videoElement.muted = true

    // Wait for video to be ready
    await new Promise((resolve) => {
      if (videoElement) {
        videoElement.onloadedmetadata = resolve
      }
    })

    await videoElement.play().catch((err) => {
      console.error("Error playing video:", err)
    })

    // Create and set up canvas for WebGL
    const glCanvas = document.createElement("canvas")
    glCanvas.width = 640 // Higher resolution for better quality
    glCanvas.height = 480

    // Create a second canvas for final compositing or reuse existing
    if (!outputCanvasRef) {
      outputCanvasRef = document.createElement("canvas")
      outputCanvasRef.width = 640
      outputCanvasRef.height = 480
    }

    if (canvasRef.current) {
      canvasRef.current = outputCanvasRef
    }

    // Initialize WebGL on the first canvas
    const webglInitResult = this.initWebGL(glCanvas)
    if (!webglInitResult) {
      console.error("Failed to initialize WebGL, falling back to raw stream")
      setLocalStream(stream)
      return stream
    }

    // Load BodyPix model with a lock to prevent multiple simultaneous loads
    if (!net && !isModelLoading) {
      console.log("Loading BodyPix model...")
      isModelLoading = true

      try {
        // Use a more efficient model configuration
        net = await bodyPix.load({
          architecture: "MobileNetV1",
          outputStride: 16,
          multiplier: 0.75, // Higher multiplier for better quality
          quantBytes: 2,
        })
        console.log("BodyPix model loaded successfully")
        isModelLoading = false
      } catch (error) {
        console.error("Failed to load BodyPix model:", error)
        isModelLoading = false
        // If model fails to load, return the original stream
        setLocalStream(stream)
        return stream
      }
    } else if (isModelLoading) {
      console.log("BodyPix model is already loading, waiting...")
      // Wait for model to finish loading (with timeout)
      let attempts = 0
      while (isModelLoading && attempts < 20) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        attempts++
      }

      if (!net) {
        console.error("Timed out waiting for BodyPix model to load")
        setLocalStream(stream)
        return stream
      }
    }

    // Start rendering frames
    this.renderFrame(glCanvas, outputCanvasRef, backgroundImageRef)

    // Capture stream and add audio
    let outputStream: MediaStream
    try {
      // Create new stream with higher framerate
      outputStream = outputCanvasRef.captureStream(30)
      outputStreamRef = outputStream
    } catch (err) {
      console.error("Error capturing canvas stream:", err)
      setLocalStream(stream)
      return stream
    }

    if (originalAudioTrack) {
      // Add the original audio track
      outputStream.addTrack(originalAudioTrack)

      // Apply current audio mute state
      originalAudioTrack.enabled = !isAudioMuted
      console.log(`Audio track added to output stream. Muted: ${isAudioMuted}`)
    } else {
      console.warn("No audio track available to add to the processed stream")
    }

    setLocalStream(outputStream)
    console.log("Background removal process initialized successfully")
    return outputStream
  },

  // Initialize WebGL for background removal
  initWebGL(canvas: HTMLCanvasElement) {
    canvas.width = 640 // Higher resolution for better quality
    canvas.height = 480

    // Try to get WebGL2 context first, then fall back to WebGL1
    let gl: WebGLRenderingContext | null = null

    try {
      // Try WebGL2 first
      gl =
        (canvas.getContext("webgl2", { powerPreference: "high-performance" }) as WebGLRenderingContext) ||
        (canvas.getContext("webgl", { powerPreference: "high-performance" }) as WebGLRenderingContext) ||
        (canvas.getContext("experimental-webgl", { powerPreference: "high-performance" }) as WebGLRenderingContext)

      if (!gl) {
        console.error("❌ WebGL not supported in this browser!")
        return null
      }
    } catch (e) {
      console.error("❌ Error initializing WebGL:", e)
      return null
    }

    glRef = gl
    console.log("✅ WebGL initialized successfully.")

    // Create shader program - simplified for just mask extraction
    const vertexShaderSource = `
      attribute vec4 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
          gl_Position = a_position;
          v_texCoord = a_texCoord;
      }
    `

    const fragmentShaderSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_videoFrame;
      uniform sampler2D u_mask;
      void main() {
          vec4 videoColor = texture2D(u_videoFrame, v_texCoord);
          float maskValue = texture2D(u_mask, v_texCoord).r;
          
          // Output just the masked video - we'll composite with background in 2D Canvas
          gl_FragColor = vec4(videoColor.rgb, maskValue);
      }
    `

    try {
      const program = this.createWebGLProgram(gl, vertexShaderSource, fragmentShaderSource)
      programRef = program

      // Set up positions (full screen quad)
      positionBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      const positions = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

      // Set up texture coordinates
      texCoordBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
      const texCoords = [0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0]
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW)

      // Get attribute locations (these are numbers)
      locationRef = {
        position: gl.getAttribLocation(program, "a_position"),
        texCoord: gl.getAttribLocation(program, "a_texCoord"),
      }

      // Get uniform locations (these are WebGLUniformLocation | null)
      uniformLocationsRef = {
        videoFrame: gl.getUniformLocation(program, "u_videoFrame"),
        mask: gl.getUniformLocation(program, "u_mask"),
      }

      // Create textures with error handling
      try {
        videoTextureRef = gl.createTexture()
        if (!videoTextureRef) {
          throw new Error("Failed to create video texture")
        }

        maskTextureRef = gl.createTexture()
        if (!maskTextureRef) {
          throw new Error("Failed to create mask texture")
        }

        // Set up textures
        this.setupTexture(gl, videoTextureRef)
        this.setupTexture(gl, maskTextureRef)
      } catch (e) {
        console.error("❌ Error creating textures:", e)
        this.cleanupWebGL()
        return null
      }

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0.0, 0.0, 0.0, 0.0) // Transparent background

      return { gl, program }
    } catch (e) {
      console.error("❌ Error setting up WebGL buffers:", e)
      this.cleanupWebGL()
      return null
    }
  },

  // Add a helper method to set up textures
  setupTexture(gl: WebGLRenderingContext, texture: WebGLTexture | null) {
    if (!texture) return

    gl.bindTexture(gl.TEXTURE_2D, texture)

    // Use safer texture parameters that work in more contexts
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // Initialize with a 1x1 transparent pixel to avoid "uninitialized texture" warnings
    const pixel = new Uint8Array([0, 0, 0, 0])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
  },

  // Create WebGL program
  createWebGLProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)

    const program = gl.createProgram()
    if (!program) {
      throw new Error("Failed to create WebGL program.")
    }

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("❌ Program link failed:", gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      throw new Error("Shader program linking failed.")
    }

    return program
  },

  // Compile shader
  compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)
    if (!shader) {
      throw new Error("Failed to create shader.")
    }

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile failed:", gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      throw new Error("Shader compilation failed.")
    }

    return shader
  },

  // Render frame with background removal
  async renderFrame(
    glCanvas: HTMLCanvasElement,
    outputCanvas: HTMLCanvasElement,
    backgroundImageRef: RefObject<HTMLImageElement | null>,
  ) {
    // If we're no longer rendering, exit early
    if (!isRendering) {
      console.log("Rendering stopped, exiting render loop")
      return
    }

    const gl = glRef
    const video = videoElement
    const outputCtx = outputCanvas.getContext("2d")

    if (!gl || !video || !video.videoWidth || !programRef || !outputCtx) {
      // Only continue the animation if we're still rendering
      if (isRendering) {
        animationFrameId = requestAnimationFrame(() => this.renderFrame(glCanvas, outputCanvas, backgroundImageRef))
      }
      return
    }

    try {
      // Always update video texture for smooth video
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, videoTextureRef)

      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      } catch (e) {
        console.error("Error updating video texture:", e)
        // Try to recover by recreating the texture
        videoTextureRef = gl.createTexture()
        if (videoTextureRef) {
          this.setupTexture(gl, videoTextureRef)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
        } else {
          throw new Error("Failed to recreate video texture")
        }
      }

      // Process segmentation on every frame for best quality
      // Enable blending for transparency
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.clear(gl.COLOR_BUFFER_BIT)

      // Get segmentation mask - Check if net is available
      try {
        if (net) {
          // Process segmentation in a try-catch to handle potential errors
          try {
            const segmentation = await net.segmentPerson(video, {
              internalResolution: "medium", // Use medium resolution for better quality
              segmentationThreshold: 0.7,
              maxDetections: 1,
            })

            // Check if we're still rendering after the async operation
            if (!isRendering) return

            // Update mask texture
            gl.activeTexture(gl.TEXTURE1)
            gl.bindTexture(gl.TEXTURE_2D, maskTextureRef)

            // Convert mask to appropriate format
            const { width, height, data } = segmentation
            const maskData = new Uint8Array(width * height * 4)

            for (let i = 0; i < data.length; i++) {
              // RGBA format for each pixel
              const pixelIndex = i * 4
              const maskValue = data[i] ? 255 : 0
              maskData[pixelIndex] = maskValue // R
              maskData[pixelIndex + 1] = maskValue // G
              maskData[pixelIndex + 2] = maskValue // B
              maskData[pixelIndex + 3] = 255 // A
            }

            try {
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, maskData)
            } catch (e) {
              console.error("Error updating mask texture:", e)
              // Try to recover by recreating the texture
              maskTextureRef = gl.createTexture()
              if (maskTextureRef) {
                this.setupTexture(gl, maskTextureRef)
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, maskData)
              } else {
                throw new Error("Failed to recreate mask texture")
              }
            }
          } catch (segError) {
            console.error("Error in segmentation processing:", segError)
          }
        } else {
          console.warn("BodyPix model not available for segmentation")
        }
      } catch (error) {
        console.error("Error in segmentation:", error)
      }

      // Set active textures for shader uniforms - do this every frame
      if (programRef) {
        gl.useProgram(programRef)

        try {
          // Position attribute
          gl.enableVertexAttribArray(locationRef.position)
          gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
          gl.vertexAttribPointer(locationRef.position, 2, gl.FLOAT, false, 0, 0)

          // TexCoord attribute
          gl.enableVertexAttribArray(locationRef.texCoord)
          gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
          gl.vertexAttribPointer(locationRef.texCoord, 2, gl.FLOAT, false, 0, 0)

          // Set uniforms for textures - using the uniform locations
          gl.uniform1i(uniformLocationsRef.videoFrame, 0) // Video is bound to texture unit 0
          gl.uniform1i(uniformLocationsRef.mask, 1) // Mask is bound to texture unit 1

          // Draw the quad
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        } catch (e) {
          console.error("Error during WebGL rendering:", e)
        }
      }

      // Now composite the result with the background in 2D canvas
      outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height)

      // Draw background image first
      if (backgroundImageRef.current) {
        outputCtx.drawImage(
          backgroundImageRef.current,
          0,
          0,
          backgroundImageRef.current.width,
          backgroundImageRef.current.height,
          0,
          0,
          outputCanvas.width,
          outputCanvas.height,
        )
      }

      // Draw the WebGL canvas (with transparent background and foreground subject) on top
      outputCtx.drawImage(
        glCanvas,
        0,
        0,
        glCanvas.width,
        glCanvas.height,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height,
      )
    } catch (error) {
      console.error("Critical error in render loop:", error)
      // If we encounter a critical error, stop the rendering loop
      this.stopRendering()
      this.cleanup()
      throw new Error("Background removal failed due to WebGL errors. Please try again.")
    }

    // Continue rendering only if we're still supposed to be rendering
    if (isRendering) {
      animationFrameId = requestAnimationFrame(() => this.renderFrame(glCanvas, outputCanvas, backgroundImageRef))
    }
  },

  // Clean up WebGL resources
  cleanupWebGL() {
    if (glRef) {
      const gl = glRef

      try {
        // Clean up existing textures
        if (videoTextureRef) {
          gl.deleteTexture(videoTextureRef)
          videoTextureRef = null
        }

        if (maskTextureRef) {
          gl.deleteTexture(maskTextureRef)
          maskTextureRef = null
        }

        // Clean up buffers
        if (positionBuffer) {
          gl.deleteBuffer(positionBuffer)
          positionBuffer = null
        }

        if (texCoordBuffer) {
          gl.deleteBuffer(texCoordBuffer)
          texCoordBuffer = null
        }

        // Delete existing program
        if (programRef) {
          gl.deleteProgram(programRef)
          programRef = null
        }

        // Reset locations
        locationRef = {
          position: -1,
          texCoord: -1,
        }

        uniformLocationsRef = {
          videoFrame: null,
          mask: null,
        }

        // Lose the context as a last step
        const loseContextExt = gl.getExtension("WEBGL_lose_context")
        if (loseContextExt) {
          loseContextExt.loseContext()
        }
      } catch (e) {
        console.error("Error during WebGL cleanup:", e)
      }

      glRef = null
    }
  },

  // Stop rendering loop
  stopRendering() {
    isRendering = false

    // Cancel any pending animation frame
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  },

  // Clean up all resources
  cleanup() {
    // First stop the rendering loop
    this.stopRendering()

    // Then clean up WebGL resources
    this.cleanupWebGL()

    // Reset video element
    if (videoElement) {
      try {
        if (videoElement.srcObject) {
          const stream = videoElement.srcObject as MediaStream
          stream.getTracks().forEach((track) => {
            try {
              track.stop()
            } catch (e) {
              console.error("Error stopping track:", e)
            }
          })
        }
        videoElement.srcObject = null
        videoElement.remove()
        videoElement = null
      } catch (e) {
        console.error("Error cleaning up video element:", e)
      }
    }

    // Don't set net to null immediately, as there might be pending operations
    console.log("✅ Background processor resources cleaned up")
  },
}

export default BackgroundProcessor

