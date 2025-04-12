import type React from "react"
import type { Metadata } from "next"
import { Navigate } from "@/components/Navigation"
import { Toaster } from "react-hot-toast"
import "./globals.css"
import { PeerProvider } from "@/contexts/PeerContext"
import { MenuBar } from "@/components/menu-bar"

export const metadata: Metadata = {
  title: "File Sharing and Video Call App",
  description: "A peer-to-peer file sharing and Video Calling app Fast and Secure ",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <PeerProvider>
          <MenuBar />
          <main className="relative min-h-screen w-full overflow-hidden">
            <div className="absolute inset-0 bg-[url('/background_image.jpg')] bg-cover bg-center blur-xl scale-110" />
            <div className="relative z-10">{children}</div>
          </main>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "rgba(0, 0, 0, 0.8)",
                color: "#fff",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
              },
              duration: 3000,
            }}
          />
          <Navigate />
        </PeerProvider>
      </body>
    </html>
  )
}
