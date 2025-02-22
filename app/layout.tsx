import type { Metadata } from "next"
import { Geist, Azeret_Mono as Geist_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { Navigate } from "@/components/Navigation"
import "./globals.css"
import { PeerProvider } from "@/contexts/PeerContext"
import { MenuBar } from "@/components/menu-bar"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "P2P File Sharing and Chat",
  description: "A peer-to-peer file sharing and chat application",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PeerProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
            <main className="bg-custom"><MenuBar/>{children}</main>
            <Toaster />
            <Navigate />
          </ThemeProvider>
        </PeerProvider>
      </body>
    </html>
  )
}