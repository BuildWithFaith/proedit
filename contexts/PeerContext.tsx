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
  sendData: (data: any) => void;
  connectToPeer: (recipientId: string) => void;
  disconnectPeer: () => void;
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

  const { toast } = useToast();

  useEffect(() => {
    const newPeer = new Peer();
    newPeer.on("open", (id) => {
      setPeerId(id);
      setPeer(newPeer);
      toast({ title: "Peer Created", description: `Your peer ID is: ${id}` });
    });

    newPeer.on("connection", (conn) => {
      setConnection(conn);
      conn.on("open", () => {
        setIsConnected(true);
        setConnectedPeerId(conn.peer);
        toast({ title: "Connected", description: `Connected to peer: ${conn.peer}` });
      });
      conn.on("data", (data) => console.log("Received data:", data));
      conn.on("close", () => {
        setConnection(null);
        setIsConnected(false);
        setConnectedPeerId(null);
      });
    });

    // newPeer.on("call", (call) => {
    //   navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
    //     setLocalStream(stream);
    //     call.answer(stream);
    //     call.on("stream", (remoteStream) => setRemoteStream(remoteStream));
    //     call.on("close", () => {
    //       setRemoteStream(null);
    //       setMediaConnection(null);
    //     });
    //     setMediaConnection(call);
    //     setIsConnected(true);
    //     setConnectedPeerId(call.peer);
    //   });
    // });

    newPeer.on("disconnected", () => newPeer.reconnect());
    newPeer.on("error", (err) => toast({ title: "Peer Error", description: err.message, variant: "destructive" }));

    return () => newPeer.destroy();
  }, []);

  const sendData = (data: any) => {
    if (connection) {
      connection.send(data);
    } else {
      toast({ title: "Error", description: "No active connection to send data.", variant: "destructive" });
    }
  };

  const connectToPeer = (recipientId: string) => {
    if (!peer) return;
    const conn = peer.connect(recipientId);
    conn.on("open", () => {
      setIsConnected(true);
      setConnectedPeerId(recipientId);
      setConnection(conn);
      toast({ title: "Connected", description: `Connected to peer: ${recipientId}` });
    });
    conn.on("close", () => {
      setConnection(null);
      setIsConnected(false);
      setConnectedPeerId(null);
    });
  };

  const disconnectPeer = () => {
    connection?.close();
    mediaConnection?.close();
    setIsConnected(false);
    setConnectedPeerId(null);
    setConnection(null);
    setMediaConnection(null);
    setLocalStream(null);
    setRemoteStream(null);
    toast({ title: "Disconnected", description: "You have been disconnected." });
  };

// const startCall = (recipientId: string) => {
//   if (!peer) return;
//   navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
//     setLocalStream(stream);
//     const call = peer.call(recipientId, stream);
//     call.on("stream", (remoteStream) => setRemoteStream(remoteStream));
//     call.on("close", () => {
//       setRemoteStream(null);
//       setMediaConnection(null);
//     });
//     setMediaConnection(call);
//     setIsConnected(true);
//     setConnectedPeerId(recipientId);
//   });
// };

// const endCall = () => {
//   if (mediaConnection) {
//     mediaConnection.close();
//     setMediaConnection(null);
//   }
//   localStream?.getTracks().forEach((track) => track.stop());
//   setLocalStream(null);
//   setRemoteStream(null);
//   toast({ title: "Call Ended", description: "The call has been terminated" });
// };

  return (
    <PeerContext.Provider value={{ peer, peerId, isConnected, connectedPeerId, localStream, remoteStream, connection, sendData, connectToPeer, disconnectPeer}}>
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