// VideoCallControls.tsx
import React from 'react';
import { Button } from "@/components/ui/button";
import { usePeer } from "@/contexts/PeerContext";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Monitor, 
  StopCircle 
} from "lucide-react";

export function VideoCallControls() {
  const {
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    endCall,
  } = usePeer();

  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-gray-800 rounded-lg">
      <Button
        onClick={toggleAudio}
        variant={isAudioEnabled ? "default" : "destructive"}
        size="icon"
        className="rounded-full w-12 h-12"
      >
        {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
      </Button>

      <Button
        onClick={toggleVideo}
        variant={isVideoEnabled ? "default" : "destructive"}
        size="icon"
        className="rounded-full w-12 h-12"
      >
        {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
      </Button>

      <Button
        onClick={isScreenSharing ? stopScreenShare : startScreenShare}
        variant={isScreenSharing ? "destructive" : "default"}
        size="icon"
        className="rounded-full w-12 h-12"
      >
        {isScreenSharing ? <StopCircle size={24} /> : <Monitor size={24} />}
      </Button>

      <Button
        onClick={endCall}
        variant="destructive"
        size="icon"
        className="rounded-full w-12 h-12"
      >
        <PhoneOff size={24} />
      </Button>
    </div>
  );
}