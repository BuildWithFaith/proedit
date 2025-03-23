import type { RefObject } from "react"

interface VideoDisplayProps {
    remoteStream: MediaStream | null
    remoteVideoRef: RefObject<HTMLVideoElement | null>
    localVideoRef: RefObject<HTMLVideoElement | null>
    connectedPeerId: string | null
    isVideoEnabled: boolean
}

export default function VideoDisplay({
    remoteStream,
    remoteVideoRef,
    localVideoRef,
    connectedPeerId,
    isVideoEnabled,
}: VideoDisplayProps) {
    return (
        <div className="relative w-full h-[60vh] sm:h-[70vh] md:h-[75vh] flex justify-center items-center rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-900 mt-12 sm:mt-16">
            {/* Remote Video */}
            {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
                <div className="flex flex-col items-center justify-center h-full w-full p-4">
                    <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-gray-800 flex items-center justify-center mb-2 sm:mb-4">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400"
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
                        </svg>
                    </div>
                    <p className="text-gray-400 text-base sm:text-lg text-center">No one has joined yet</p>
                    <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2 text-center">
                        Start call to connect with someone
                    </p>
                </div>
            )}

            {/* Connection ID Overlay */}
            {connectedPeerId && (
                <div className="absolute top-2 sm:top-4 left-2 sm:left-4 bg-black bg-opacity-70 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm">
                    Connected to: {connectedPeerId.substring(0, 6)}...
                </div>
            )}

            {/* Local Video */}
            <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 w-24 h-36 sm:w-32 sm:h-48 md:w-44 md:h-64 rounded-lg overflow-hidden shadow-lg border-2 border-gray-700 bg-gray-900 transition-all duration-300 hover:scale-105">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8 text-gray-400"
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                        </svg>
                    </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 py-1 px-2 text-center">
                    <p className="text-xs sm:text-sm">You</p>
                </div>
            </div>
        </div>
    )
}

