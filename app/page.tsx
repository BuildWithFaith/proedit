"use client"

import AppSeo from "@/components/AppSeo"
import { useState, useEffect } from "react"
import { motion, AnimatePresence, LayoutGroup } from "motion/react"
import { usePeer } from "@/contexts/PeerContext"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, Link, UserMinus, QrCode, Clipboard, Check } from "lucide-react"
import { toast } from "@/components/ui-toast"

export default function Home() {
  const { peerId, isConnected, connectedPeerId, connectToPeer, disconnectPeer } = usePeer()
  const [recipientId, setRecipientId] = useState("")
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    console.log("Home page - Connection state:", {
      isConnected,
      connectedPeerId,
    })
  }, [isConnected, connectedPeerId])

  const copyPeerId = () => {
    navigator.clipboard.writeText(peerId)
    toast.success("Peer ID copied to clipboard")
  }

  const handleConnect = () => {
    if (recipientId.trim()) {
      connectToPeer(recipientId.trim())
    } else {
      toast.error("Please enter a valid Peer ID to connect")
    }
  }

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (clipboardText.trim()) {
        setRecipientId(clipboardText.trim())
      } else {
        toast.error("Your clipboard doesn't contain any text")
      }
    } catch (error) {
      toast.error("Could not access clipboard. Please check permissions")
    }
  }

  // Multi-function button that handles different actions based on which part is clicked
  type MultiActionType = "disconnect" | "copy" | "qr"

  type MultiActionHandler = (action: MultiActionType) => void

  const handleMultiFunction: MultiActionHandler = (action) => {
    switch (action) {
      case "disconnect":
        disconnectPeer()
        break
      case "copy":
        copyPeerId()
        break
      case "qr":
        setShowQR(true)
        break
      default:
        break
    }
  }

  return (
    <div>
      <AppSeo />
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <LayoutGroup>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
              staggerChildren: 0.1,
            }}
            className="w-full max-w-lg"
          >
            <div className="backdrop-blur-xl rounded-3xl border bg-white/5 border-white/20 shadow-2xl overflow-hidden p-8">
              {/* Glassmorphism effect for visionOS */}
              <div className="absolute inset-0 bg-white/10 border-0 shadow-lg rounded-3xl pointer-events-none" />

              <h2 className="text-3xl font-medium text-center text-white mb-8">P2P File Sharing & Video Call</h2>

              {/* Peer ID Section */}
              <div className="space-y-4 mb-8">
                <p className="text-white/70 text-center">Your Peer ID:</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 px-4 py-3 rounded-2xl border border-white/10 backdrop-blur-md font-mono text-white text-sm">
                    {peerId}
                  </div>

                  {!isConnected ? (
                    <>
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Button
                          onClick={copyPeerId}
                          variant="ghost"
                          size="icon"
                          className="text-white rounded-xl backdrop-blur-md"
                        >
                          <Copy size={20} />
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Button
                          onClick={() => setShowQR(true)}
                          variant="ghost"
                          size="icon"
                          className="text-white rounded-xl backdrop-blur-md"
                        >
                          <QrCode size={20} />
                        </Button>
                      </motion.div>
                    </>
                  ) : (
                    <motion.div
                      className="flex gap-2"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    >
                      <Button
                        onClick={() => handleMultiFunction("copy")}
                        variant="ghost"
                        size="icon"
                        className="text-white rounded-xl backdrop-blur-md"
                      >
                        <Copy size={20} />
                      </Button>
                      <Button
                        onClick={() => handleMultiFunction("qr")}
                        variant="ghost"
                        size="icon"
                        className="text-white rounded-xl backdrop-blur-md"
                      >
                        <QrCode size={20} />
                      </Button>
                      <Button
                        onClick={() => handleMultiFunction("disconnect")}
                        variant="destructive"
                        size="icon"
                        className="bg-red-500/30 hover:bg-red-500/40 text-red-200 border border-red-500/20 rounded-xl backdrop-blur-md"
                      >
                        <UserMinus size={20} />
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Connect Section - Only show when not connected */}
              {!isConnected && (
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-2">
                    <Input
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                      placeholder="Enter recipient's Peer ID"
                      className="flex-1 bg-transparent border-white/10 text-white placeholder:text-white/50 rounded-xl backdrop-blur-md focus:border-white/30 focus:ring-white/20"
                      style={{
                        WebkitAppearance: "none",
                        color: "white",
                      }}
                    />
                    <Button
                      onClick={handlePaste}
                      variant="ghost"
                      size="icon"
                      className="text-white rounded-xl backdrop-blur-md border border-white/10"
                      title="Paste from clipboard"
                    >
                      <Clipboard size={20} />
                    </Button>
                  </div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <button
                      onClick={handleConnect}
                      className="w-full py-2 px-4 flex items-center justify-center text-white rounded-xl backdrop-blur-md transition-all duration-300 bg-transparent hover:bg-white/10 border border-white/10"
                    >
                      <Link size={20} className="mr-2" />
                      Connect
                    </button>
                  </motion.div>
                </div>
              )}

              {/* Connection Status - Show when connected */}
              {isConnected && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                  }}
                  className="mb-4 p-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-200 text-center"
                >
                  <Check className="inline-block mr-2 size-5" />
                  <span>
                    Connected to: <span className="font-mono">{connectedPeerId?.substring(0, 8)}...</span>
                  </span>
                </motion.div>
              )}
            </div>
          </motion.div>
        </LayoutGroup>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
                mass: 1,
              }}
              className="p-8 rounded-3xl border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <h3 className="text-xl font-medium text-white mb-4">Your Peer ID QR Code</h3>
                <div className="bg-white p-4 rounded-2xl shadow-inner">
                  <QRCodeSVG value={peerId} size={200} />
                </div>
                <Button
                  onClick={() => setShowQR(false)}
                  variant="ghost"
                  className="mt-6 text-white bg-black/20 hover:bg-black/30 rounded-xl backdrop-blur-md border border-white/10"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
