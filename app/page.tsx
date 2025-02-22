"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { usePeer } from "@/contexts/PeerContext"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, Link, UserMinus, QrCode } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { MenuBar } from "@/components/menu-bar"

export default function Home() {
  const { peerId, isConnected, connectedPeerId, connectToPeer, disconnectPeer } = usePeer()
  const [recipientId, setRecipientId] = useState("")
  const [showQR, setShowQR] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    console.log("Home page - Connection state:", { isConnected, connectedPeerId })
  }, [isConnected, connectedPeerId])

  const copyPeerId = () => {
    navigator.clipboard.writeText(peerId)
    toast({ title: "Peer ID Copied", description: "Your Peer ID has been copied to the clipboard." })
  }

  const handleConnect = () => {
    if (recipientId.trim()) {
      connectToPeer(recipientId.trim())
    } else {
      toast({
        title: "Invalid Peer ID",
        description: "Please enter a valid Peer ID to connect.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="relative min-h-screen w-full">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden p-8">
            <h2 className="text-3xl font-semibold text-center text-white mb-8">P2P File Sharing & Video Call</h2>

            {/* Peer ID Section */}
            <div className="space-y-4 mb-8">
              <p className="text-white/70 text-center">Your Peer ID:</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 px-4 py-3 bg-white/10 rounded-2xl border border-white/10 font-mono text-white text-sm">
                  {peerId}
                </div>
                <Button onClick={copyPeerId} variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <Copy size={20} />
                </Button>
                <Button
                  onClick={() => setShowQR(true)}
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                >
                  <QrCode size={20} />
                </Button>
              </div>
            </div>

            {/* Connect Section */}
            <div className="space-y-4 mb-8">
              <Input
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                placeholder="Enter recipient's Peer ID"
                className="bg-white/10 border-white/10 text-white placeholder:text-white/50"
              />
              <Button
                onClick={handleConnect}
                className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/20"
              >
                <Link size={20} className="mr-2" />
                Connect
              </Button>
            </div>

            {/* Disconnect Button */}
            {isConnected && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Button
                  onClick={disconnectPeer}
                  variant="destructive"
                  className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20"
                >
                  <UserMinus size={20} className="mr-2" />
                  Disconnect
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <h3 className="text-xl font-medium text-white mb-4">Your Peer ID QR Code</h3>
                <div className="bg-white p-4 rounded-2xl">
                  <QRCodeSVG value={peerId} size={200} />
                </div>
                <Button onClick={() => setShowQR(false)} variant="ghost" className="mt-4 text-white hover:bg-white/10">
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

