"use client"

import { useEffect } from "react"

import { useState, useRef } from "react"

interface ControlBarProps {
    remoteStream: MediaStream | null
    startCall: () => void
    endCall: () => void
    isAudioMuted: boolean
    toggleAudio: () => void
    isVideoEnabled: boolean
    toggleVideo: () => void
    backgroundRemovalEnabled: boolean
    setBackgroundRemovalEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void
    selectedBackground: string
    setSelectedBackground: (background: string) => void
}

export default function ControlBar({
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
}: ControlBarProps) {
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement | null>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    return (
        <div className="fixed bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 sm:space-x-4 bg-gray-900 bg-opacity-90 px-3 sm:px-6 py-3 sm:py-4 rounded-full shadow-lg border border-gray-700 z-20 w-[95%] sm:w-auto justify-center">
            {/* Call Button */}
            {!remoteStream ? (
                <button
                    onClick={startCall}
                    className="bg-green-600 hover:bg-green-700 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition shadow-lg group relative"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 sm:h-6 sm:w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                    </svg>
                    <span className="absolute -bottom-6 sm:-bottom-8 whitespace-nowrap text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        Start Call
                    </span>
                </button>
            ) : (
                <button
                    onClick={endCall}
                    className="bg-red-600 hover:bg-red-700 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition shadow-lg group relative"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 sm:h-6 sm:w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
                        />
                    </svg>
                    <span className="absolute -bottom-6 sm:-bottom-8 whitespace-nowrap text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        End Call
                    </span>
                </button>
            )}

            {/* Audio Control Button */}
            <button
                onClick={toggleAudio}
                className={`${isAudioMuted ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-600"} w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition shadow-lg group relative`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={
                            isAudioMuted
                                ? "M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                : "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        }
                    />
                    {isAudioMuted && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />}
                </svg>
                <span className="absolute -bottom-6 sm:-bottom-8 whitespace-nowrap text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    {isAudioMuted ? "Unmute" : "Mute"}
                </span>
            </button>

            {/* Video Control Button */}
            <button
                onClick={toggleVideo}
                className={`${!isVideoEnabled ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-600"} w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition shadow-lg group relative`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                    {!isVideoEnabled && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />}
                </svg>
                <span className="absolute -bottom-6 sm:-bottom-8 whitespace-nowrap text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    {isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
                </span>
            </button>

            {/* Background Button - Dropdown with hover persistence */}
            <div className="relative" ref={dropdownRef}>
                {/* Button and label container */}
                <div className="flex flex-col items-center group">
                    <button
                        className="bg-gray-700 hover:bg-gray-600 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition shadow-lg relative"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 sm:h-5 sm:w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>

                        {/* Hover label - positioned below the button */}
                        <div className="absolute top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                            <span className="bg-gray-800 text-white text-xs py-1 px-2 rounded shadow-lg">Background</span>
                        </div>
                    </button>
                </div>

                {/* Background Dropdown Panel */}
                <div
                    className={`absolute bottom-20 sm:bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-95 rounded-lg p-2 sm:p-3 shadow-lg border border-gray-700 w-48 sm:w-56 flex flex-wrap gap-1 sm:gap-2 z-30 transition-opacity duration-200 ${dropdownOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"}`}
                >
                    <p className="w-full text-center text-xs sm:text-sm text-gray-300 mb-1 sm:mb-2">Select Background</p>

                    {/* Background removal toggle */}
                    <div className="w-full flex items-center justify-between px-1 mb-2">
                        <span className="text-xs sm:text-sm text-gray-300">Background Removal</span>
                        <button
                            onClick={() => setBackgroundRemovalEnabled((prev) => !prev)}
                            className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${backgroundRemovalEnabled ? "bg-blue-600 justify-end" : "bg-gray-600 justify-start"}`}
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
                                <div className="w-full h-full bg-gray-700 flex items-center justify-center text-sm sm:text-base">
                                    🏢
                                </div>
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
                                <div className="w-full h-full bg-gray-700 flex items-center justify-center text-sm sm:text-base">
                                    🌆
                                </div>
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
        </div>
    )
}

