"use client"
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";
import { useToast } from "@/components/ui/use-toast";
import * as bodyPix from "@tensorflow-models/body-pix";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgpu";

const backgrounds = [
  { name: "Beach", src: "/backgrounds/beach.jpg" },
  { name: "City", src: "/backgrounds/city.jpg" },
  { name: "Mountains", src: "/backgrounds/mountains.avif" },
  { name: "Office", src: "/backgrounds/office.avif" },
];

interface PeerContextType {
  peerId: string;
  isConnected: boolean;
  connectedPeerId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connection: DataConnection | null;
  mediaConnection: MediaConnection | null;
  isCallActive: boolean;
  segmentationEnabled: boolean;
  selectedBackground: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sendData: (data: any) => void;
  connectToPeer: (recipientId: string) => void;
  disconnectPeer: () => void;
  startCall: (recipientId: string) => void;
  endCall: () => void;
  toggleSegmentation: () => void;
  updateBackground: (background: string) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
}

const PeerContext = createContext<PeerContextType | undefined>(undefined);

export function PeerProvider({ children }: { children: React.ReactNode }) {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string>("");
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [mediaConnection, setMediaConnection] = useState<MediaConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedPeerId, setConnectedPeerId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [segmentationEnabled, setSegmentationEnabled] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState("Beach");
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  
  const screenShareStream = useRef<MediaStream | null>(null);
  const modelRef = useRef<bodyPix.BodyPix | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameId = useRef<number | undefined>(undefined);

  const { toast } = useToast();

  const processVideo = async () => {
    if (!videoRef.current || !canvasRef.current || !modelRef.current || !segmentationEnabled) {
      return;
    }

    try {
      const segmentation = await modelRef.current.segmentPerson(videoRef.current);
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;

      if (backgroundImage) {
        ctx.drawImage(
          backgroundImage, 
          0, 
          0, 
          canvasRef.current.width,
          canvasRef.current.height
        );
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      const pixels = imageData.data;
      const personMask = segmentation.data;

      const video = videoRef.current;
      ctx.drawImage(video, 0, 0);
      const frameData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      const framePixels = frameData.data;

      for (let i = 0; i < personMask.length; i++) {
        const n = i * 4;
        if (personMask[i]) {
          pixels[n] = framePixels[n];
          pixels[n + 1] = framePixels[n + 1];
          pixels[n + 2] = framePixels[n + 2];
          pixels[n + 3] = framePixels[n + 3];
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const processedStream = canvasRef.current.captureStream(30);
      
      if (localStream) {
        const processedTrack = processedStream.getVideoTracks()[0];
        
        if (mediaConnection?.peerConnection) {
          const sender = mediaConnection.peerConnection
            .getSenders()
            .find(s => s.track?.kind === 'video');
            
          if (sender) {
            await sender.replaceTrack(processedTrack);
          }
        }
      }

    } catch (error) {
      console.error('Error in video processing:', error);
    }

    animationFrameId.current = requestAnimationFrame(processVideo);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      canvasRef.current = document.createElement("canvas");
      
      const newPeer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
          ]
        }
      });

      newPeer.on("open", (id) => {
        setPeerId(id);
        setPeer(newPeer);
        toast({ title: "Connected to Server", description: `Your ID: ${id}` });
      });

      newPeer.on("error", (error) => {
        toast({ 
          title: "Connection Error", 
          description: error.message,
          variant: "destructive"
        });
      });

      newPeer.on("connection", handlePeerConnection);
      newPeer.on("call", handleIncomingCall);

      loadBodyPixModel();

      return () => {
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        if (newPeer) {
          newPeer.destroy();
        }
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
      };
    }
  }, []);

  const loadBodyPixModel = async () => {
    try {
      await tf.setBackend("webgpu");
      await tf.ready();
      modelRef.current = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });
      toast({ title: "Body Segmentation Ready", description: "Background effects available" });
    } catch (error) {
      toast({ 
        title: "Model Loading Error", 
        description: "Background effects may not be available",
        variant: "destructive"
      });
    }
  };

  const handlePeerConnection = (conn: DataConnection) => {
    setConnection(conn);
    setupConnectionHandlers(conn);
  };

  const setupConnectionHandlers = (conn: DataConnection) => {
    conn.on("open", () => {
      setIsConnected(true);
      setConnectedPeerId(conn.peer);
      toast({ title: "Peer Connected", description: `Connected to: ${conn.peer}` });
    });

    conn.on("data", (data) => {
      console.log("Received data:", data);
    });

    conn.on("close", () => {
      setConnection(null);
      setIsConnected(false);
      setConnectedPeerId(null);
      toast({ title: "Peer Disconnected", description: "Connection closed" });
    });
  };

  const handleIncomingCall = async (call: MediaConnection) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setLocalStream(stream);
      call.answer(stream);
      setupCallHandlers(call);
      
      setMediaConnection(call);
      setIsCallActive(true);
      setConnectedPeerId(call.peer);
      
      toast({ title: "Incoming Call", description: "Call connected successfully" });
    } catch (error) {
      toast({ 
        title: "Call Error", 
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  };

  const setupCallHandlers = (call: MediaConnection) => {
    call.on("stream", (stream) => {
      setRemoteStream(stream);
      toast({ title: "Remote Stream", description: "Remote video connected" });
    });

    call.on("close", () => {
      setRemoteStream(null);
      setMediaConnection(null);
      setIsCallActive(false);
      toast({ title: "Call Ended", description: "Call has been terminated" });
    });

    call.on("error", (error) => {
      toast({ 
        title: "Call Error", 
        description: error.message,
        variant: "destructive"
      });
    });
  };

  const startCall = async (recipientId: string) => {
    if (!peer) {
      toast({ 
        title: "Error", 
        description: "Peer connection not initialized",
        variant: "destructive"
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setLocalStream(stream);
      const call = peer.call(recipientId, stream);
      setupCallHandlers(call);
      
      setMediaConnection(call);
      setIsCallActive(true);
      setConnectedPeerId(recipientId);
      
      toast({ title: "Call Started", description: "Connecting to peer..." });
    } catch (error) {
      toast({ 
        title: "Call Error", 
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  };

  const updateBackground = async (background: string) => {
    setSelectedBackground(background);
    try {
      const selectedBg = backgrounds.find(bg => bg.name === background);
      if (selectedBg) {
        const img = new Image();
        img.src = selectedBg.src;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        setBackgroundImage(img);
      }
    } catch (error) {
      console.error('Error loading background image:', error);
    }
  };

  const toggleSegmentation = () => {
    setSegmentationEnabled(prev => {
      const newValue = !prev;
      if (newValue) {
        if (videoRef.current && localStream) {
          videoRef.current.srcObject = localStream;
          processVideo();
        }
      } else {
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
        if (mediaConnection?.peerConnection && localStream) {
          const sender = mediaConnection.peerConnection
            .getSenders()
            .find(s => s.track?.kind === 'video');
          const originalTrack = localStream.getVideoTracks()[0];
          if (sender && originalTrack) {
            sender.replaceTrack(originalTrack);
          }
        }
      }
      return newValue;
    });
  };

  const connectToPeer = (recipientId: string) => {
    if (!peer) return;
    
    const conn = peer.connect(recipientId);
    setConnection(conn);
    setupConnectionHandlers(conn);
  };

  const disconnectPeer = () => {
    if (connection) {
      connection.close();
    }
    if (mediaConnection) {
      mediaConnection.close();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setConnection(null);
    setMediaConnection(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setIsCallActive(false);
    setConnectedPeerId(null);
    toast({ title: "Disconnected", description: "All connections closed" });
  };

  const endCall = () => {
    if (mediaConnection) {
      mediaConnection.close();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    toast({ title: "Call Ended", description: "Call has been terminated" });
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      if (localStream) {
        screenShareStream.current = stream;

        const screenTrack = stream.getVideoTracks()[0];
        const sender = mediaConnection?.peerConnection
          ?.getSenders()
          .find((s) => s.track?.kind === 'video');

        if (sender) {
          await sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      }
    } catch (error) {
      toast({
        title: "Screen Share Error",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  };
  
  const stopScreenShare = () => {
    if (screenShareStream.current && localStream) {
      screenShareStream.current.getTracks().forEach(track => track.stop());

      const originalVideoTrack = localStream.getVideoTracks()[0];

      const sender = mediaConnection?.peerConnection
        ?.getSenders()
        .find((s) => s.track?.kind === 'video');

      if (sender && originalVideoTrack) {
        sender.replaceTrack(originalVideoTrack);
      }

      screenShareStream.current = null;
      setIsScreenSharing(false);
    }
  };

  const sendData = (data: any) => {
    if (connection) {
      connection.send(data);
    }
  };

  return (
    <PeerContext.Provider
      value={{
        peerId,
        isConnected,
        connectedPeerId,
        localStream,
        remoteStream,
        connection,
        mediaConnection,
        isCallActive,
        segmentationEnabled,
        selectedBackground,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        videoRef,
        sendData,
        connectToPeer,
        disconnectPeer,
        startCall,
        endCall,
        toggleSegmentation,
        updateBackground,
        toggleAudio,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
}

export function usePeer() {
  const context = useContext(PeerContext);
  if (!context) {
    throw new Error("usePeer must be used within a PeerProvider");
  }
  return context;
}