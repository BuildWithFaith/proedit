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
        glCanvas.width = 640
        glCanvas.height = 480

        // Create a second canvas for final compositing
        const outputCanvas = document.createElement("canvas")
        outputCanvas.width = 640
        outputCanvas.height = 480
        if (canvasRef.current) {
            canvasRef.current = outputCanvas
        }

        // Initialize WebGL on the first canvas
        this.initWebGL(glCanvas)

        // Load BodyPix model
        if (!net) {
            console.log("Loading BodyPix model...")
            try {
                net = await bodyPix.load({
                    architecture: "MobileNetV1",
                    outputStride: 16,
                    multiplier: 0.75,
                    quantBytes: 2,
                })
                console.log("BodyPix model loaded successfully")
            } catch (error) {
                console.error("Failed to load BodyPix model:", error)
                // If model fails to load, return the original stream
                setLocalStream(stream)
                return stream
            }
        }

        // Start rendering frames
        this.renderFrame(glCanvas, outputCanvas, backgroundImageRef)

        // Capture stream and add audio
        const outputStream = outputCanvas.captureStream(30)
        if (originalAudioTrack) {
            outputStream.addTrack(originalAudioTrack)

            // Apply current audio mute state
            originalAudioTrack.enabled = !isAudioMuted
            console.log(`Audio track added to output stream. Muted: ${isAudioMuted}`)
        } else {
            console.warn("No audio track available to add to the processed stream")
        }

        setLocalStream(outputStream)

        return outputStream
    },

    // Initialize WebGL for background removal
    initWebGL(canvas: HTMLCanvasElement) {
        canvas.width = 640
        canvas.height = 480

        const gl = canvas.getContext("webgl")
        if (!gl) {
            console.error("❌ WebGL not supported!")
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

        const program = this.createWebGLProgram(gl, vertexShaderSource, fragmentShaderSource)
        programRef = program
        //gl.useProgram(program) // Moved to renderFrame to avoid conditional hook call

        // Set up positions (full screen quad)
        const positionBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
        const positions = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

        // Set up texture coordinates
        const texCoordBuffer = gl.createBuffer()
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

        // Create textures
        videoTextureRef = gl.createTexture()
        maskTextureRef = gl.createTexture()

            // Set up textures
            ;[videoTextureRef, maskTextureRef].forEach((texture) => {
                gl.bindTexture(gl.TEXTURE_2D, texture)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            })

        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0.0, 0.0, 0.0, 0.0) // Transparent background

        return { gl, program }
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

        // Enable blending for transparency
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        gl.clear(gl.COLOR_BUFFER_BIT)

        // 1. Update video texture
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, videoTextureRef)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

        // 2. Get segmentation mask - Check if net is available
        try {
            if (net) {
                const segmentation = await net.segmentPerson(video, {
                    internalResolution: "medium",
                    segmentationThreshold: 0.7,
                    maxDetections: 1,
                })

                // Check if we're still rendering after the async operation
                if (!isRendering) return

                // 3. Update mask texture
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

                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, maskData)
            } else {
                console.warn("BodyPix model not available for segmentation")
            }
        } catch (error) {
            console.error("Error in segmentation:", error)
        }

        // 4. Set active textures for shader uniforms
        //gl.useProgram(programRef) // Moved to renderFrame to avoid conditional hook call
        if (programRef) {
            gl.useProgram(programRef)

            // Position attribute
            gl.enableVertexAttribArray(locationRef.position)
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
            gl.vertexAttribPointer(locationRef.position, 2, gl.FLOAT, false, 0, 0)

            // TexCoord attribute
            gl.enableVertexAttribArray(locationRef.texCoord)
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), gl.STATIC_DRAW)
            gl.vertexAttribPointer(locationRef.texCoord, 2, gl.FLOAT, false, 0, 0)

            // Set uniforms for textures - using the uniform locations
            gl.uniform1i(uniformLocationsRef.videoFrame, 0) // Video is bound to texture unit 0
            gl.uniform1i(uniformLocationsRef.mask, 1) // Mask is bound to texture unit 1

            // Draw the quad
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
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
        outputCtx.drawImage(glCanvas, 0, 0)

        // Continue rendering only if we're still supposed to be rendering
        if (isRendering) {
            animationFrameId = requestAnimationFrame(() => this.renderFrame(glCanvas, outputCanvas, backgroundImageRef))
        }
    },

    // Clean up WebGL resources
    cleanupWebGL() {
        if (glRef) {
            const gl = glRef

            // Clean up existing textures
            if (videoTextureRef) gl.deleteTexture(videoTextureRef)
            if (maskTextureRef) gl.deleteTexture(maskTextureRef)

            // Delete existing program
            if (programRef) {
                gl.deleteProgram(programRef)
                programRef = null
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
            if (videoElement.srcObject) {
                const stream = videoElement.srcObject as MediaStream
                stream.getTracks().forEach((track) => track.stop())
            }
            videoElement.srcObject = null
            videoElement = null
        }

        // Don't set net to null immediately, as there might be pending operations
        // Instead, we'll handle null checks in the renderFrame method
        console.log("✅ Background processor resources cleaned up")
    },
}

export default BackgroundProcessor

