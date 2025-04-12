"use client";

import React, { createContext, useState, useEffect, useContext } from "react";
import Peer, { DataConnection } from "peerjs";
import toast from "react-hot-toast"

interface PeerContextType {
  peer: Peer | null;
  peerId: string;
  connectedPeerId: string | null;
  isConnected: boolean;
  connection: DataConnection | null;
  connectToPeer: (recipientId: string) => void;
  disconnectPeer: () => void;
  sendData: (data: any) => void;
  setConnectedPeerId: (id: string | null) => void
}

const PeerContext = createContext<PeerContextType | undefined>(undefined);

export function PeerProvider({ children }: { children: React.ReactNode }) {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string>("");
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedPeerId, setConnectedPeerId] = useState<string | null>(null);

  useEffect(() => {
    const newPeer = new Peer();

    newPeer.on("open", (id) => {
      setPeerId(id);
      setPeer(newPeer);
    });

    newPeer.on("connection", (conn) => {
      setConnection(conn);

      conn.on("open", () => {
        setIsConnected(true);
        setConnectedPeerId(conn.peer);
        toast(`Connected to: ${conn.peer}`);
      });

      conn.on("data", (data) => {
        console.log("Received data:", data);
      });

      conn.on("close", () => {
        setConnection(null);
        setIsConnected(false);
        setConnectedPeerId(null);
      });
    });

    newPeer.on("error", (err) => {
      toast.error(`Connection Error,
        err.message`);
    });

    return () => {
      newPeer.destroy();
    };
  }, []);

  const connectToPeer = (recipientId: string) => {
    if (!peer) return;

    try {
      const conn = peer.connect(recipientId);

      conn.on("open", () => {
        setIsConnected(true);
        setConnectedPeerId(recipientId);
        setConnection(conn);
        toast(`Connected to: ${recipientId}`);
      });

      conn.on("close", () => {
        setConnection(null);
        setIsConnected(false);
        setConnectedPeerId(null);
      });
    } catch (error) {
      toast.error("Failed to connect");
    }
  };

  const disconnectPeer = () => {
    connection?.close();
    setIsConnected(false);
    setConnectedPeerId(null);
    setConnection(null);
    toast.success(`Disconnected
      Peer connection closed` );
  };

  const sendData = (data: any) => {
    if (connection?.open) {
      connection.send(data);
    } else {
      toast.error("No active connection");
    }
  };

  return (
    <PeerContext.Provider
      value={{
        peer,
        peerId,
        connectedPeerId,
        isConnected,
        connection,
        connectToPeer,
        disconnectPeer,
        sendData,
        setConnectedPeerId
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