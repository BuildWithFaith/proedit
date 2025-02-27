"use client";
import { useState, useEffect, useRef } from "react";
import { usePeer } from "@/contexts/PeerContext";
import * as bodyPix from "@tensorflow-models/body-pix";
import "@tensorflow/tfjs-backend-webgl";
import { MediaConnection } from "peerjs";

export default function Home() {
  const { peer, peerId, connectedPeerId } = usePeer();
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [selectedBackground, setSelectedBackground] = useState("/background/office.avif");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  let net: bodyPix.BodyPix | null = null;

  const videoElement = useRef<HTMLVideoElement | null>(null);
  const videoTextureRef = useRef<WebGLTexture | null>(null);
  const maskTextureRef = useRef<WebGLTexture | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  
  // Background image element for compositing
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  // Fixed type definitions for shader locations
  const locationRef = useRef({
    position: -1,
    texCoord: -1,
  });

  // Separate ref for uniform locations with correct type
  const uniformLocationsRef = useRef<{
    videoFrame: WebGLUniformLocation | null;
    mask: WebGLUniformLocation | null;
  }>({
    videoFrame: null,
    mask: null
  });

  useEffect(() => {
    if (localVideoRef.current && canvasRef.current) {
      localVideoRef.current.srcObject = canvasRef.current.captureStream(30) || null;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, canvasRef.current]);
  
  useEffect(() => {
    // Preload the selected background
    const img = new Image();
    img.src = selectedBackground;
    img.onload = () => {
      backgroundImageRef.current = img;
      console.log(`✅ Background loaded: ${selectedBackground}`);
    };
  }, [selectedBackground]);
  
  const initWebGL = (canvas: HTMLCanvasElement) => {
    canvas.width = 640;  // Set appropriate dimensions
    canvas.height = 480;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("❌ WebGL not supported!");
      return null;
    }

    glRef.current = gl;
    console.log("✅ WebGL initialized successfully.");

    // Create shader program - simplified for just mask extraction
    const vertexShaderSource = `
      attribute vec4 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
          gl_Position = a_position;
          v_texCoord = a_texCoord;
      }
    `;

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
    `;

    const program = createWebGLProgram(gl, vertexShaderSource, fragmentShaderSource);
    programRef.current = program;
    gl.useProgram(program);

    // Set up positions (full screen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
      -1.0, -1.0,
      1.0, -1.0,
      -1.0, 1.0,
      1.0, 1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Set up texture coordinates
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    const texCoords = [
      0.0, 1.0,
      1.0, 1.0,
      0.0, 0.0,
      1.0, 0.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

    // Get attribute locations (these are numbers)
    locationRef.current = {
      position: gl.getAttribLocation(program, "a_position"),
      texCoord: gl.getAttribLocation(program, "a_texCoord"),
    };

    // Get uniform locations (these are WebGLUniformLocation | null)
    uniformLocationsRef.current = {
      videoFrame: gl.getUniformLocation(program, "u_videoFrame"),
      mask: gl.getUniformLocation(program, "u_mask")
    };

    // Create textures
    videoTextureRef.current = gl.createTexture();
    maskTextureRef.current = gl.createTexture();

    // Set up textures
    [videoTextureRef.current, maskTextureRef.current].forEach(texture => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    });

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent background

    return { gl, program };
  };

  const createWebGLProgram = (gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram => {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    if (!program) {
      throw new Error("Failed to create WebGL program.");
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("❌ Program link failed:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      throw new Error("Shader program linking failed.");
    }

    return program;
  };

  const compileShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader => {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("Failed to create shader.");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile failed:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      throw new Error("Shader compilation failed.");
    }

    return shader;
  };

  const getProcessedStream = async (): Promise<MediaStream> => {
    // Request user media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: true
    });

    // Set up video element
    videoElement.current = document.createElement("video");
    videoElement.current.srcObject = stream;
    videoElement.current.autoplay = true;
    videoElement.current.playsInline = true;
    videoElement.current.muted = true;

    // Wait for video to be ready
    await new Promise((resolve) => {
      if (videoElement.current) {
        videoElement.current.onloadedmetadata = resolve;
      }
    });

    await videoElement.current.play().catch(err => {
      console.error("Error playing video:", err);
    });

    // Create and set up canvas for WebGL
    const glCanvas = document.createElement("canvas");
    glCanvas.width = 640;
    glCanvas.height = 480;
    
    // Create a second canvas for final compositing
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = 640;
    outputCanvas.height = 480;
    canvasRef.current = outputCanvas;
    
    // Initialize WebGL on the first canvas
    initWebGL(glCanvas);

    // Load BodyPix model
    if (!net) {
      console.log("Loading BodyPix model...");
      net = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });
      console.log("BodyPix model loaded successfully");
    }

    // Start rendering frames
    renderFrame(glCanvas, outputCanvas);

    // Capture stream and add audio
    const outputStream = outputCanvas.captureStream(30);
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      outputStream.addTrack(audioTrack);
    }

    return outputStream;
  };

  const renderFrame = async (glCanvas: HTMLCanvasElement, outputCanvas: HTMLCanvasElement) => {
    const gl = glRef.current;
    const video = videoElement.current;
    const outputCtx = outputCanvas.getContext('2d');

    if (!gl || !video || !video.videoWidth || !programRef.current || !outputCtx) {
      requestAnimationFrame(() => renderFrame(glCanvas, outputCanvas));
      return;
    }

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 1. Update video texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTextureRef.current);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    // 2. Get segmentation mask
    try {
      const segmentation = await net!.segmentPerson(video, {
        internalResolution: 'medium',
        segmentationThreshold: 0.7,
        maxDetections: 1
      });

      // 3. Update mask texture
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, maskTextureRef.current);

      // Convert mask to appropriate format
      const { width, height, data } = segmentation;
      const maskData = new Uint8Array(width * height * 4);

      for (let i = 0; i < data.length; i++) {
        // RGBA format for each pixel
        const pixelIndex = i * 4;
        const maskValue = data[i] ? 255 : 0;
        maskData[pixelIndex] = maskValue;     // R
        maskData[pixelIndex + 1] = maskValue; // G
        maskData[pixelIndex + 2] = maskValue; // B
        maskData[pixelIndex + 3] = 255;       // A
      }

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        maskData
      );
    } catch (error) {
      console.error("Error in segmentation:", error);
    }

    // 4. Set active textures for shader uniforms
    gl.useProgram(programRef.current);

    // Position attribute
    gl.enableVertexAttribArray(locationRef.current.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.vertexAttribPointer(locationRef.current.position, 2, gl.FLOAT, false, 0, 0);

    // TexCoord attribute
    gl.enableVertexAttribArray(locationRef.current.texCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
      gl.STATIC_DRAW
    );
    gl.vertexAttribPointer(locationRef.current.texCoord, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms for textures - using the uniform locations
    gl.uniform1i(uniformLocationsRef.current.videoFrame, 0); // Video is bound to texture unit 0
    gl.uniform1i(uniformLocationsRef.current.mask, 1);       // Mask is bound to texture unit 1

    // Draw the quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Now composite the result with the background in 2D canvas
    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    
    // Draw background image first
    if (backgroundImageRef.current) {
      outputCtx.drawImage(
        backgroundImageRef.current,
        0, 0, backgroundImageRef.current.width, backgroundImageRef.current.height,
        0, 0, outputCanvas.width, outputCanvas.height
      );
    }
    
    // Draw the WebGL canvas (with transparent background and foreground subject) on top
    outputCtx.drawImage(glCanvas, 0, 0);

    // Continue rendering
    requestAnimationFrame(() => renderFrame(glCanvas, outputCanvas));
  };

  const startCall = async () => {
    if (!peer || !connectedPeerId) return;

    try {
      const processedStream = await getProcessedStream();

      console.log("🎥 Setting local video stream...");
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = processedStream;
      }

      console.log("📞 Calling peer:", connectedPeerId);
      const call = peer.call(connectedPeerId, processedStream);

      call.on("stream", (incomingStream) => {
        console.log("🎬 Received Remote Stream:", incomingStream);
        setRemoteStream(incomingStream);
      });

      call.on("error", (err) => {
        console.error("Call error:", err);
      });

      call.on("close", () => {
        console.log("Call closed");
        setRemoteStream(null);
      });
    } catch (error) {
      console.error("Error starting call:", error);
    }
  };

  useEffect(() => {
    if (!peer) return;

    const handleIncomingCall = async (incomingCall: MediaConnection) => {
      console.log("📞 Incoming call from:", incomingCall.peer);

      try {
        const processedStream = await getProcessedStream();
        console.log("🎥 Processed Stream for Auto-Answering:", processedStream);

        incomingCall.answer(processedStream);
        console.log("✅ Auto-Answered the call");

        incomingCall.on("stream", (incomingStream: MediaStream) => {
          console.log("🎬 Receiving Remote Video Stream:", incomingStream);
          setRemoteStream(incomingStream);
        });

        incomingCall.on("close", () => {
          console.log("❌ Call Ended");
          setRemoteStream(null);
        });
      } catch (error) {
        console.error("Error handling incoming call:", error);
      }
    };

    peer.on("call", handleIncomingCall);

    return () => {
      peer.off("call", handleIncomingCall);
    };
  }, [peer]);

  const preloadImages = (imagePaths: string[]) => {
    return Promise.all(
      imagePaths.map((path) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.src = path;
          img.onload = () => {
            console.log(`✅ Preloaded: ${path}`);
            resolve(img);
          };
          img.onerror = () => {
            console.error(`❌ Failed to preload: ${path}`);
            reject(path);
          };
        });
      })
    );
  };

  // ✅ Preload images when the app starts
  useEffect(() => {
    preloadImages([
      "/background/office.avif",
      "/background/beach.jpg",
      "/background/city.jpg",
      "/background/mountains.avif",
    ]).then(() => console.log("✅ All backgrounds preloaded!"));
  }, []);

  return (
    <div 
      className="absolute inset-0 bg-cover bg-center transition-all duration-300"
      style={{ backgroundImage: `url(${selectedBackground})` }}
    >
      <h1 className="text-xl mb-4">Video Call with WebGL Background Removal</h1>
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mb-4">
        <div className="flex flex-col items-center">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-64 h-48 bg-black rounded"
          />
          <p className="mt-2">Your ID: {peerId}</p>
        </div>
        <div className="flex flex-col items-center">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-64 h-48 bg-black rounded"
          />
          <p className="mt-2">Remote Video</p>
        </div>
      </div>
      <div className="flex flex-col space-y-4">
        <div className="flex space-x-2">
          <button
            onClick={startCall}
            className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded transition-colors"
          >
            Start Call
          </button>
        </div>

        <div className="flex space-x-2 mt-4">
          <p className="mr-2">Background:</p>
          <button
            onClick={() => setSelectedBackground("/background/office.avif")}
            className="bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-sm transition-colors"
          >
            Office
          </button>
          <button
            onClick={() => setSelectedBackground("/background/beach.jpg")}
            className="bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-sm transition-colors"
          >
            Beach
          </button>
          <button
            onClick={() => setSelectedBackground("/background/city.jpg")}
            className="bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-sm transition-colors"
          >
            City
          </button>
          <button
            onClick={() => setSelectedBackground("/background/mountains.avif")}
            className="bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-sm transition-colors"
          >
            Mountains
          </button>
        </div>
      </div>
    </div>
  );
}