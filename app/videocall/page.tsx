"use client"
import React, { useEffect, useRef, useState } from "react";
import { usePeer } from "@/contexts/PeerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoCallControls } from "@/components/VideoCallControls";

const backgrounds = [
  { name: "Beach", src: "/backgrounds/beach.jpg" },
  { name: "City", src: "/backgrounds/city.jpg" },
  { name: "Mountains", src: "/backgrounds/mountains.avif" },
  { name: "Office", src: "/backgrounds/office.avif" },
];

export default function VideoCallComponent() {
  const {
    peerId,
    remoteStream,
    localStream,
    startCall,
    endCall,
    connectToPeer,
    disconnectPeer,
    isConnected,
    isCallActive,
    connectedPeerId,
    toggleSegmentation,
    segmentationEnabled,
    updateBackground,
    videoRef
  } = usePeer();

  const [recipientId, setRecipientId] = useState("");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [selectedBackground, setSelectedBackground] = useState(backgrounds[0].name);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleConnect = () => {
    if (recipientId && !isConnected) {
      connectToPeer(recipientId);
    }
  };

  const handleStartCall = () => {
    if (connectedPeerId && !isCallActive) {
      startCall(connectedPeerId);
    }
  };

  const handleBackgroundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBackground = e.target.value;
    setSelectedBackground(newBackground);
    updateBackground(newBackground);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Video Call</CardTitle>
          <div className="text-sm text-gray-500">Your ID: {peerId}</div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Connection Controls */}
            {!isConnected && (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter peer ID to connect"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                />
                <Button onClick={handleConnect}>Connect</Button>
              </div>
            )}

            {/* Video Displays */}
            <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={(el) => {
                  localVideoRef.current = el;
                  if (el) {
                    videoRef.current = el;
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {remoteStream && (
                <div className="absolute top-4 right-4 w-1/4 aspect-video">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover rounded-lg border-2 border-white"
                  />
                </div>
              )}
            </div>

            {/* Call Controls */}
            <div className="flex justify-center gap-4">
              {isConnected && !isCallActive && (
                <Button onClick={handleStartCall} className="bg-green-500 hover:bg-green-600">
                  Start Call
                </Button>
              )}
              {isCallActive && (
                <Button onClick={endCall} className="bg-red-500 hover:bg-red-600">
                  End Call
                </Button>
              )}
              {isConnected && (
                <Button onClick={disconnectPeer} variant="destructive">
                  Disconnect
                </Button>
              )}
            </div>

            {/* Background Controls */}
            <div className="flex items-center gap-4">
              <select
                value={selectedBackground}
                onChange={handleBackgroundChange}
                className="p-2 border rounded"
              >
                {backgrounds.map((bg) => (
                  <option key={bg.name} value={bg.name}>
                    {bg.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={segmentationEnabled}
                  onChange={toggleSegmentation}
                />
                Enable Background Effect
              </label>
              {isCallActive && <VideoCallControls />}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


