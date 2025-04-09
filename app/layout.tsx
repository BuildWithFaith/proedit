import type { Metadata } from "next";
import { Navigate } from "@/components/Navigation";
import { Toaster } from "@/components/ui/toaster";
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
          <main className="relative min-h-screen w-full overflow-hidden">
            <div className="absolute inset-0 bg-[url('/background_image.jpg')] bg-cover bg-center blur-xl scale-110" />
            <div className="relative z-10">{children}</div>
          </main>
          <Toaster />
          <Navigate />
        </PeerProvider>
      </body>
    </html>
  );
}
