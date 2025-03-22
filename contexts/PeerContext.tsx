"use client";

import React, { createContext, useState, useEffect, useContext } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";
import { useToast } from "@/components/ui/use-toast";

interface PeerContextType {
  peer: Peer | null;
  peerId: string;
  isConnected: boolean;
  connectedPeerId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connection: DataConnection | null;
  connectionQuality: 'good' | 'fair' | 'poor';
  isConnecting: boolean;
  isDisconnecting: boolean;
  sendData: (data: any) => void;
  connectToPeer: (recipientId: string) => void;
  disconnectPeer: () => void;
  startLocalStream: (constraints?: MediaStreamConstraints) => Promise<void>;
  stopLocalStream: () => void;
  callPeer: (recipientId: string) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
}

const PeerContext = createContext<PeerContextType | undefined>(undefined);

interface PeerData {
  type: 'media-offer' | 'media-answer' | string;
  [key: string]: any;
}

export function PeerProvider({ children }: { children: React.ReactNode }) {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string>("");
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [mediaConnection, setMediaConnection] = useState<MediaConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectedPeerId, setConnectedPeerId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const { toast } = useToast();

  const monitorConnectionQuality = (conn: DataConnection) => {
    const interval = setInterval(() => {
      if (conn.open) {
        const quality = conn.label === 'reliable' ? 'good' : 'poor';
        setConnectionQuality(quality);
      }
    }, 5000);

    return () => clearInterval(interval);
  };

  useEffect(() => {
    const newPeer = new Peer();

    newPeer.on("open", (id) => {
      setPeerId(id);
      setPeer(newPeer);
      toast({ title: "Peer Created", description: `Your peer ID is: ${id}` });
    });

    newPeer.on("connection", (conn) => {
      setConnection(conn);
      const cleanup = monitorConnectionQuality(conn);

      conn.on("open", () => {
        setIsConnected(true);
        setConnectedPeerId(conn.peer);
        setReconnectAttempts(0);
        toast({ title: "Connected", description: `Connected to peer: ${conn.peer}` });
      });

      conn.on("data", (data: unknown) => {
        console.log("Received data:", data);
        if (typeof data === 'object' && data !== null) {
          const peerData = data as PeerData;
          if (peerData.type === 'media-offer') {
            // Handle media offer
          } else if (peerData.type === 'media-answer') {
            // Handle media answer
          }
        }
      });

      conn.on("close", () => {
        cleanup();
        setConnection(null);
        setIsConnected(false);
        setConnectedPeerId(null);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          setReconnectAttempts(prev => prev + 1);
          setTimeout(() => {
            if (peer) {
              connectToPeer(conn.peer);
            }
          }, 1000 * Math.pow(2, reconnectAttempts));
        }
      });
    });

    newPeer.on("call", async (call) => {
      setMediaConnection(call);
      call.on("stream", (stream) => {
        setRemoteStream(stream);
        toast({ title: "Incoming Call", description: "Received remote stream" });
      });
      call.on("close", () => {
        setMediaConnection(null);
        setRemoteStream(null);
      });
    });

    newPeer.on("disconnected", () => {
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        newPeer.reconnect();
        setReconnectAttempts(prev => prev + 1);
      } else {
        toast({
          title: "Connection Failed",
          description: "Maximum reconnection attempts reached",
          variant: "destructive"
        });
      }
    });

    newPeer.on("error", (err) => {
      toast({
        title: "Peer Error",
        description: err.message,
        variant: "destructive"
      });
      if (err.type === 'network') {
        // Handle network errors specifically
      }
    });

    return () => {
      newPeer.destroy();
    };
  }, []);

  const startLocalStream = async (constraints: MediaStreamConstraints = { video: true, audio: true }) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      toast({ title: "Local Stream Started", description: "Camera and microphone access granted" });
    } catch (error) {
      toast({
        title: "Media Error",
        description: "Failed to access camera and microphone",
        variant: "destructive"
      });
      throw error;
    }
  };

  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  };

  const callPeer = async (recipientId: string) => {
    if (!peer || !localStream) {
      toast({
        title: "Call Failed",
        description: "Please start your camera first",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsConnecting(true);
      const call = peer.call(recipientId, localStream);
      setMediaConnection(call);

      call.on("stream", (stream) => {
        setRemoteStream(stream);
        setIsConnecting(false);
        toast({ title: "Call Connected", description: "Remote stream received" });
      });

      call.on("close", () => {
        setMediaConnection(null);
        setRemoteStream(null);
        setIsConnecting(false);
      });
    } catch (error) {
      setIsConnecting(false);
      toast({
        title: "Call Failed",
        description: "Failed to establish call",
        variant: "destructive"
      });
    }
  };

  const answerCall = async () => {
    if (!mediaConnection || !localStream) return;

    try {
      mediaConnection.answer(localStream);
      toast({ title: "Call Answered", description: "You answered the call" });
    } catch (error) {
      toast({
        title: "Answer Failed",
        description: "Failed to answer call",
        variant: "destructive"
      });
    }
  };

  const rejectCall = () => {
    if (mediaConnection) {
      mediaConnection.close();
      setMediaConnection(null);
      toast({ title: "Call Rejected", description: "You rejected the call" });
    }
  };

  const sendData = (data: any) => {
    if (connection?.open) {
      connection.send(data);
    } else {
      toast({
        title: "Error",
        description: "No active connection to send data.",
        variant: "destructive"
      });
    }
  };

  const connectToPeer = async (recipientId: string) => {
    if (!peer) return;

    try {
      setIsConnecting(true);
      const conn = peer.connect(recipientId);

      conn.on("open", () => {
        setIsConnected(true);
        setConnectedPeerId(recipientId);
        setConnection(conn);
        setIsConnecting(false);
        toast({ title: "Connected", description: `Connected to peer: ${recipientId}` });
      });

      conn.on("close", () => {
        setConnection(null);
        setIsConnected(false);
        setConnectedPeerId(null);
        setIsConnecting(false);
      });
    } catch (error) {
      setIsConnecting(false);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to peer",
        variant: "destructive"
      });
    }
  };

  const disconnectPeer = async () => {
    try {
      setIsDisconnecting(true);
      connection?.close();
      mediaConnection?.close();
      stopLocalStream();
      setIsConnected(false);
      setConnectedPeerId(null);
      setConnection(null);
      setMediaConnection(null);
      setLocalStream(null);
      setRemoteStream(null);
      toast({ title: "Disconnected", description: "You have been disconnected." });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <PeerContext.Provider
      value={{
        peer,
        peerId,
        isConnected,
        isConnecting,
        isDisconnecting,
        connectedPeerId,
        localStream,
        remoteStream,
        connection,
        connectionQuality,
        sendData,
        connectToPeer,
        disconnectPeer,
        startLocalStream,
        stopLocalStream,
        callPeer,
        answerCall,
        rejectCall
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