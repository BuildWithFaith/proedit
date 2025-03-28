"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Home, MenuIcon, Video, Share, X } from "lucide-react"
import Link from "next/link"

interface MenuItem {
  icon: React.ReactNode
  label: string
  href: string
  gradient: string
  iconColor: string
}

const menuItems: MenuItem[] = [
  {
    icon: <Home className="h-5 w-5" />,
    label: "Home",
    href: "/",
    gradient: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.06) 50%, rgba(29,78,216,0) 100%)",
    iconColor: "text-blue-500",
  },
  {
    icon: <Video className="h-5 w-5" />,
    label: "Video Call",
    href: "/videocall",
    gradient: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, rgba(234,88,12,0.06) 50%, rgba(194,65,12,0) 100%)",
    iconColor: "text-orange-500",
  },
  {
    icon: <Share className="h-5 w-5" />,
    label: "Share Files",
    href: "/sharefiles",
    gradient: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.06) 50%, rgba(21,128,61,0) 100%)",
    iconColor: "text-green-500",
  },
]

function Menu() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Detect screen size and update isMobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024) // Using the same breakpoint as in use-mobile.tsx
    }

    handleResize() // Run once on mount
    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Handle clicks outside the menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Close menu when pressing Escape key
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (isOpen && event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscKey)
    return () => {
      document.removeEventListener("keydown", handleEscKey)
    }
  }, [isOpen])

  // Only render on mobile
  if (!isMobile) return null

  return (
    <span>
      {/* Mobile menu button */}
      <motion.button
        ref={buttonRef}
        className="fixed top-4 right-4 z-50 p-2 rounded-full bg-background/80 backdrop-blur-lg border border-border/40 shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <MenuIcon className="h-6 w-6" />
      </motion.button>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop - clicking here will close the menu */}
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Menu content */}
            <motion.nav
              ref={menuRef}
              className="p-4 rounded-2xl bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-lg border border-border/40 shadow-lg relative flex flex-col items-center justify-center w-[90%] max-w-sm"
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
            >
              <motion.ul
                className="flex flex-col items-center gap-6 w-full"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1,
                    },
                  },
                }}
                initial="hidden"
                animate="show"
              >
                {menuItems.map((item, index) => (
                  <motion.li
                    key={item.label}
                    className="relative w-full"
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      show: { opacity: 1, y: 0 },
                    }}
                  >
                    <Link href={item.href} onClick={() => setIsOpen(false)}>
                      <motion.div
                        className="flex items-center gap-3 px-6 py-4 rounded-xl text-lg bg-white/10 backdrop-blur-md transition"
                        style={{
                          background: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)`,
                          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                        }}
                        whileHover={{
                          scale: 1.03,
                          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
                          background: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.07) 100%)`,
                        }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <motion.div
                          className={`${item.iconColor} p-2 rounded-full`}
                          style={{ background: item.gradient }}
                        >
                          {item.icon}
                        </motion.div>
                        <span>{item.label}</span>
                      </motion.div>
                    </Link>
                  </motion.li>
                ))}
              </motion.ul>

              {/* Close Button */}
              <motion.button
                className="mt-10 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white"
                onClick={() => setIsOpen(false)}
                whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="h-6 w-6" />
              </motion.button>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}

export default Menu

export function MenuBar() {
  return (
    <div className="flex justify-evenly items-center absolute w-full z-50">
      <span className="flex justify-evenly items-center">
        <Menu />
      </span>
    </div>
  )
}
