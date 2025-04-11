"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Monitor, StopCircle, Camera, Image } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface ControlBarProps {
  remoteStream: MediaStream | null
  startCall: () => void
  endCall: () => void
  isAudioMuted: boolean
  toggleAudio: () => void
  isVideoEnabled: boolean
  toggleVideo: () => void
  backgroundRemovalEnabled: boolean
  setBackgroundRemovalEnabled: (enabled: boolean) => void
  selectedBackground: string
  setSelectedBackground: (background: string) => void
  isLoading: boolean
  callStatus: "idle" | "connecting" | "connected" | "ending"
  hasMultipleCameras: boolean
  switchCamera: () => void
  currentCameraName: string
  isScreenSharing: boolean
  startScreenShare: () => void
  stopScreenShare: () => void
}

const ControlBar: React.FC<ControlBarProps> = ({
  remoteStream,
  startCall,
  endCall,
  isAudioMuted,
  toggleAudio,
  isVideoEnabled,
  toggleVideo,
  backgroundRemovalEnabled,
  setBackgroundRemovalEnabled,
  selectedBackground,
  setSelectedBackground,
  isLoading,
  callStatus,
  hasMultipleCameras,
  switchCamera,
  currentCameraName,
  isScreenSharing,
  startScreenShare,
  stopScreenShare,
}) => {
  const backgrounds = [
    { name: "Living Room", path: "/background/livingroom.jpg" },
    { name: "Living Room 2", path: "/background/livingroom2.jpg" },
    { name: "Living Room 3", path: "/background/livingroom3.jpg" },
    { name: "Office", path: "/background/office.jpg" },
  ]

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 md:gap-3 flex-wrap">
      {/* Audio toggle button */}
      <Button
        onClick={toggleAudio}
        disabled={isLoading}
        size="icon"
        variant={isAudioMuted ? "destructive" : "secondary"}
        className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
      >
        {isAudioMuted ? <MicOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Mic className="h-5 w-5 sm:h-6 sm:w-6" />}
      </Button>

      {/* Video toggle button */}
      <Button
        onClick={toggleVideo}
        disabled={isLoading}
        size="icon"
        variant={!isVideoEnabled ? "destructive" : "secondary"}
        className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
      >
        {!isVideoEnabled ? <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Video className="h-5 w-5 sm:h-6 sm:w-6" />}
      </Button>

      {/* Call control button */}
      {callStatus === "idle" ? (
        <Button
          onClick={startCall}
          disabled={isLoading}
          size="icon"
          variant="default"
          className="bg-green-500 hover:bg-green-600 rounded-full w-10 h-10 sm:w-12 sm:h-12"
        >
          <Phone className="h-6 w-6 sm:h-7 sm:w-7" />
        </Button>
      ) : (
        <Button
          onClick={endCall}
          disabled={isLoading}
          size="icon"
          variant="destructive"
          className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
        >
          <PhoneOff className="h-6 w-6 sm:h-7 sm:w-7" />
        </Button>
      )}

      {/* Screen sharing buttons */}
      {callStatus === "connected" && (
        <>
          {!isScreenSharing ? (
            <Button
              onClick={startScreenShare}
              disabled={isLoading}
              size="icon"
              variant="secondary"
              className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
            >
              <Monitor className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          ) : (
            <Button
              onClick={stopScreenShare}
              disabled={isLoading}
              size="icon"
              variant="destructive"
              className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
            >
              <StopCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          )}
        </>
      )}

      {/* Camera switch button */}
      {hasMultipleCameras && (
        <Button
          onClick={switchCamera}
          disabled={isLoading}
          size="icon"
          variant="secondary"
          className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
        >
          <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      )}

      {/* Background removal dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={isLoading}
            size="icon"
            variant={backgroundRemovalEnabled ? "default" : "secondary"}
            className={`rounded-full w-10 h-10 sm:w-12 sm:h-12 ${
              backgroundRemovalEnabled ? "bg-blue-500 hover:bg-blue-600" : ""
            }`}
          >
            <Image className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setBackgroundRemovalEnabled(!backgroundRemovalEnabled)}>
            {backgroundRemovalEnabled ? "Disable" : "Enable"} Background Removal
          </DropdownMenuItem>
          {backgroundRemovalEnabled && (
            <>
              <DropdownMenuItem disabled className="opacity-50 cursor-default">
                Select Background:
              </DropdownMenuItem>
              {backgrounds.map((bg) => (
                <DropdownMenuItem
                  key={bg.path}
                  onClick={() => setSelectedBackground(bg.path)}
                  className={selectedBackground === bg.path ? "bg-blue-100 dark:bg-blue-900" : ""}
                >
                  {bg.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default ControlBar
