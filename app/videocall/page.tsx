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
  const [backgroundRemovalEnabled, setBackgroundRemovalEnabled] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [activeCall, setActiveCall] = useState<MediaConnection | null>(null);
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
    // Set the local video source
    if (localVideoRef.current) {
      if (backgroundRemovalEnabled && canvasRef.current) {
        localVideoRef.current.srcObject = canvasRef.current.captureStream(30) || null;
      } else if (localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }

    // Set the remote video source
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, localStream, canvasRef.current, backgroundRemovalEnabled]);

  // Add this effect to handle background removal toggle changes
  useEffect(() => {
    // Skip if no existing stream
    if (!localStream) return;

    console.log("Background removal setting changed, updating streams...");

    // Stop current streams first
    const videoToStop = localVideoRef.current?.srcObject as MediaStream;
    if (videoToStop) {
      videoToStop.getTracks().forEach(track => track.stop());
    }

    // Get new processed stream with updated background removal setting
    getProcessedStream()
      .then(newStream => {
        // If we have an active call, update its track
        if (activeCall) {
          updateRemoteStream(newStream);
        }
      })
      .catch(err => {
        console.error("Error reinitializing stream after background toggle:", err);
      });
  }, [backgroundRemovalEnabled, selectedBackground, activeCall]);

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

    // Add this at the beginning of getProcessedStream
    if (glRef.current) {
      const gl = glRef.current;

      // Clean up existing textures
      if (videoTextureRef.current) gl.deleteTexture(videoTextureRef.current);
      if (maskTextureRef.current) gl.deleteTexture(maskTextureRef.current);

      // Delete existing program
      if (programRef.current) {
        gl.deleteProgram(programRef.current);
        programRef.current = null;
      }

      glRef.current = null;
    }

    // Request user media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: true
    });

    // If background removal is disabled, store and return the raw stream
    if (!backgroundRemovalEnabled) {
      setLocalStream(stream);
      return stream;
    }

    // Set up video element for background removal processing
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

    setLocalStream(outputStream);
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

    // Add this in renderFrame function after compositing background
    console.log(`Rendering frame with background: ${backgroundRemovalEnabled ? selectedBackground : 'none'}`);
    if (backgroundImageRef.current) {
      console.log(`Background image dimensions: ${backgroundImageRef.current.width}x${backgroundImageRef.current.height}`);
    } else if (backgroundRemovalEnabled) {
      console.error("Background image not loaded!");
    }

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
      setActiveCall(call); // Store the call reference

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

  const updateRemoteStream = async (newStream: MediaStream) => {
    if (!activeCall || !activeCall.peerConnection) {
      console.log("No active call to update");
      return;
    }

    try {
      const videoTrack = newStream.getVideoTracks()[0];

      if (!videoTrack) {
        console.error("No video track in new stream");
        return;
      }

      console.log("Replacing video track in active connection");

      // Get all senders in the peer connection
      const senders = activeCall.peerConnection.getSenders();

      // Find the video sender
      const videoSender = senders.find(sender =>
        sender.track && sender.track.kind === 'video'
      );

      if (videoSender) {
        // Replace the track
        await videoSender.replaceTrack(videoTrack);
        console.log("✅ Remote video track replaced successfully");
      } else {
        console.error("No video sender found in peer connection");
      }
    } catch (error) {
      console.error("Error updating remote stream:", error);
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
        setActiveCall(incomingCall); // Store the call reference
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

  const endCall = () => {
    console.log("📞 Ending call...");

    setActiveCall(null);

    // 1. Get references to all connections first
    const currentPeer = peer;
    const currentLocalVideo = localVideoRef.current;
    const currentRemoteVideo = remoteVideoRef.current;
    const currentCanvas = canvasRef.current;
    const currentVideoElement = videoElement.current;

    // 2. Close all media connections specifically
    if (currentPeer) {
      try {
        // Properly close each media connection
        Object.values(currentPeer.connections).forEach(connections => {
          connections.forEach((conn: any) => {
            console.log("Closing connection:", conn);
            if (conn.type === 'media' && conn.close) {
              conn.close();
            }
            if (conn.peerConnection) {
              conn.peerConnection.close();
            }
          });
        });

        // Remove all listeners to avoid memory leaks
        currentPeer.removeAllListeners();
      } catch (e) {
        console.error("Error closing peer connections:", e);
      }
    }

    // 3. Stop all media tracks from all possible sources
    const stopAllTracksFromStream = (stream: MediaStream | null) => {
      if (!stream) return;
      console.log("Stopping tracks for stream:", stream.id);
      stream.getTracks().forEach(track => {
        console.log("Stopping track:", track.id, track.kind);
        track.stop();
      });
    };

    // Stop local video stream
    if (currentLocalVideo?.srcObject) {
      stopAllTracksFromStream(currentLocalVideo.srcObject as MediaStream);
      currentLocalVideo.srcObject = null;
      console.log("✅ Local video stream cleared");
    }

    // Stop remote video stream
    if (currentRemoteVideo?.srcObject) {
      stopAllTracksFromStream(currentRemoteVideo.srcObject as MediaStream);
      currentRemoteVideo.srcObject = null;
      console.log("✅ Remote video stream cleared");
    }

    // Stop original user media stream
    if (currentVideoElement?.srcObject) {
      stopAllTracksFromStream(currentVideoElement.srcObject as MediaStream);
      currentVideoElement.srcObject = null;
      console.log("✅ Original video element stream cleared");
    }

    // Stop canvas stream
    if (backgroundRemovalEnabled && currentCanvas) {
      try {
        const canvasStream = currentCanvas.captureStream();
        stopAllTracksFromStream(canvasStream);
        console.log("✅ Canvas stream stopped");
      } catch (e) {
        console.error("Error stopping canvas stream:", e);
      }
    }

    // 4. Reset global state
    setRemoteStream(null);

    // 5. Clean up WebGL resources if background removal was enabled
    if (backgroundRemovalEnabled && glRef.current) {
      try {
        const gl = glRef.current;

        // Delete textures
        if (videoTextureRef.current) gl.deleteTexture(videoTextureRef.current);
        if (maskTextureRef.current) gl.deleteTexture(maskTextureRef.current);

        // Delete program and shaders
        if (programRef.current) {
          gl.deleteProgram(programRef.current);
          programRef.current = null;
        }

        console.log("✅ WebGL resources cleaned up");
      } catch (e) {
        console.error("Error cleaning up WebGL resources:", e);
      }
    }

    // 6. Reset BodyPix model if it was loaded
    if (backgroundRemovalEnabled) {
      net = null;
    }

    console.log("✅ Call ended successfully");
  };

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black transition-all duration-300 flex flex-col items-center justify-center text-white min-h-screen p-2 sm:p-4 md:p-6">
      {/* Status Bar - Made more compact on mobile */}
      <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-70 px-2 sm:px-4 py-2 sm:py-3 flex justify-between items-center z-10">
        <h1 className="text-lg sm:text-xl font-bold">Virtual Meeting</h1>
        <div className="flex items-center space-x-2">
          <div className="flex items-center">
            <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full mr-1 sm:mr-2 ${remoteStream ? "bg-green-500" : "bg-gray-500"}`}></div>
            <span className="text-xs sm:text-sm">{remoteStream ? "Connected" : "Disconnected"}</span>
          </div>
          <div className="bg-black bg-opacity-40 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm">
            ID: {peerId?.substring(0, 6)}
          </div>
        </div>
      </div>

      {/* Main Video Container - Improved responsiveness */}
      <div className="relative w-full h-[60vh] sm:h-[70vh] md:h-[75vh] flex justify-center items-center rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-900 mt-12 sm:mt-16">
        {/* Remote Video */}
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full p-4">
            <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-gray-800 flex items-center justify-center mb-2 sm:mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-base sm:text-lg text-center">No one has joined yet</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2 text-center">Start call to connect with someone</p>
          </div>
        )}

        {/* Connection ID Overlay - Improved visibility */}
        {connectedPeerId && (
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 bg-black bg-opacity-70 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm">
            Connected to: {connectedPeerId.substring(0, 6)}...
          </div>
        )}

        {/* Local Video - Responsive sizing */}
        <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 w-24 h-36 sm:w-32 sm:h-48 md:w-44 md:h-64 rounded-lg overflow-hidden shadow-lg border-2 border-gray-700 bg-gray-900 transition-all duration-300 hover:scale-105">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 py-1 px-2 text-center">
            <p className="text-xs sm:text-sm">You</p>
          </div>
        </div>
      </div>

      {/* Control Bar - Improved mobile layout */}
      <div className="fixed bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 sm:space-x-4 bg-gray-900 bg-opacity-90 px-3 sm:px-6 py-3 sm:py-4 rounded-full shadow-lg border border-gray-700 z-20 w-[95%] sm:w-auto justify-center">
        {/* Call Button - Responsive sizing */}
        {!remoteStream ? (
          <button
            onClick={startCall}
            className="bg-green-600 hover:bg-green-700 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition shadow-lg group relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="absolute -bottom-6 sm:-bottom-8 whitespace-nowrap text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">Start Call</span>
          </button>
        ) : (
          <button
            onClick={endCall}
            className="bg-red-600 hover:bg-red-700 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition shadow-lg group relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
            <span className="absolute -bottom-6 sm:-bottom-8 whitespace-nowrap text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">End Call</span>
          </button>
        )}

        {/* Control Buttons - Responsive sizing */}
        <button className="bg-gray-700 hover:bg-gray-600 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition shadow-lg group relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <span className="absolute -bottom-6 sm:-bottom-8 whitespace-nowrap text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">Toggle Mic</span>
        </button>

        <button className="bg-gray-700 hover:bg-gray-600 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition shadow-lg group relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="absolute -bottom-6 sm:-bottom-8 whitespace-nowrap text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">Toggle Camera</span>
        </button>

        {/* Background Button - Responsive dropdown */}
        <div className="relative group">
          <button className="bg-gray-700 hover:bg-gray-600 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <span className="absolute -bottom-6 sm:-bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">Backgrounds</span>

          {/* Background Dropdown Panel - Improved mobile layout */}
          <div className="absolute bottom-14 sm:bottom-16 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-95 rounded-lg p-2 sm:p-3 shadow-lg border border-gray-700 w-48 sm:w-56 flex-wrap gap-1 sm:gap-2 hidden group-hover:flex z-30">
            <p className="w-full text-center text-xs sm:text-sm text-gray-300 mb-1 sm:mb-2">Select Background</p>

            {/* Background removal toggle */}
            <div className="w-full flex items-center justify-between px-1 mb-2">
              <span className="text-xs sm:text-sm text-gray-300">Background Removal</span>
              <button
                onClick={() => setBackgroundRemovalEnabled(prev => !prev)}
                className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${backgroundRemovalEnabled ? 'bg-blue-600 justify-end' : 'bg-gray-600 justify-start'}`}
              >
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </button>
            </div>

            {backgroundRemovalEnabled && (
              <>
                <button
                  onClick={() => setSelectedBackground("/background/office.avif")}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden flex-shrink-0 ${selectedBackground === "/background/office.avif" ? "ring-2 ring-blue-500" : ""}`}
                >
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center text-sm sm:text-base">🏢</div>
                </button>
                <button
                  onClick={() => setSelectedBackground("/background/beach.jpg")}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden flex-shrink-0 ${selectedBackground === "/background/beach.jpg" ? "ring-2 ring-blue-500" : ""}`}
                >
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center text-sm sm:text-base">🏖️</div>
                </button>
                <button
                  onClick={() => setSelectedBackground("/background/city.jpg")}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden flex-shrink-0 ${selectedBackground === "/background/city.jpg" ? "ring-2 ring-blue-500" : ""}`}
                >
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center text-sm sm:text-base">🌆</div>
                </button>
                <button
                  onClick={() => setSelectedBackground("/background/mountains.avif")}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden flex-shrink-0 ${selectedBackground === "/background/mountains.avif" ? "ring-2 ring-blue-500" : ""}`}
                >
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center text-sm sm:text-base">⛰️</div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Settings Button - Responsive sizing */}
        <button className="bg-gray-700 hover:bg-gray-600 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition shadow-lg group relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="absolute -bottom-6 sm:-bottom-8 whitespace-nowrap text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">Settings</span>
        </button>
      </div>

      {/* Video Call Status Banner - Responsive positioning */}
      {remoteStream && (
        <div className="absolute top-14 sm:top-16 left-2 sm:left-4 right-2 sm:right-4 bg-green-600 bg-opacity-80 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-center shadow-lg flex items-center justify-center space-x-2 md:w-auto md:left-1/2 md:transform md:-translate-x-1/2">
          <div className="animate-pulse w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full"></div>
          <p className="text-xs sm:text-sm font-medium">Call in progress</p>
        </div>
      )}

      {/* Current Background Display - Responsive text */}
      <div className="absolute top-14 sm:top-16 left-2 sm:left-4 px-2 sm:px-3 py-1 bg-black bg-opacity-60 rounded-lg text-xs sm:text-sm text-gray-300">
        {backgroundRemovalEnabled
          ? `Background: ${selectedBackground.split('/').pop()?.split('.')[0] || 'default'}`
          : 'Background removal: Off'}
      </div>
    </div>
  );
}