"use client"

import { useEffect, useState } from "react"
import { Home, Video, Share } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { Button } from "./ui/button"

const navLinks = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/videocall", icon: Video, label: "Video Call" },
  { href: "/sharefiles", icon: Share, label: "Share Files" },
]

export function Navigate() {
  const [isMounted, setIsMounted] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024) // Using the same breakpoint as in use-mobile.tsx
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  if (!isMounted || !isDesktop) return null

  return (
    <nav className="fixed left-6 top-1/2 -translate-y-1/2 z-50">
      <motion.div
        className="flex flex-col gap-6 p-3 rounded-2xl border border-white/20 shadow-xl 
                  bg-white/10 backdrop-blur-md transition-all hover:backdrop-blur-xl"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        {navLinks.map(({ href, icon: Icon, label }, index) => (
          <Link key={href} href={href} className="group">
            <Button
              variant="ghost"
              size="icon"
              className="relative flex items-center justify-center p-3 rounded-xl
                        text-white/70 transition-all group-hover:text-white group-hover:bg-white/10"
              asChild
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: 0.1 * index,
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                }}
              >
                <Icon size={28} />
                <span
                  className="absolute left-14 opacity-0 group-hover:opacity-100 transition-opacity 
                           text-white bg-black/50 px-2 py-1 rounded-lg text-sm"
                >
                  {label}
                </span>
              </motion.div>
            </Button>
          </Link>
        ))}
      </motion.div>
    </nav>
  )
}
