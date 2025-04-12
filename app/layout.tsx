import type React from "react";
import type { Metadata } from "next";
import { Navigate } from "@/components/Navigation";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { PeerProvider } from "@/contexts/PeerContext";
import { MenuBar } from "@/components/menu-bar";

export const metadata: Metadata = {
  title: "File Sharing and Video Call App",
  description:
    "A peer-to-peer file sharing and Video Calling app Fast and Secure ",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <PeerProvider>
          <MenuBar />
          <main className="relative min-h-screen w-full bg-[url('/background_image.jpg')] bg-fixed bg-center bg-cover overflow-hidden">
            <div className="absolute inset-0 backdrop-blur-md bg-black/20"></div>
            <div className="relative z-10">{children}</div>
          </main>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "rgba(0, 0, 0, 0.3)",
                color: "#fff",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "14px",
                backdropFilter: "blur(10px)"
              },
              duration: 3000,
            }}
          />
          <Navigate />
        </PeerProvider>
      </body>
    </html>
  );
}
