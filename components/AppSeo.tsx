import { Metadata } from "next";
import Head from "next/head";

// Define metadata for the full app (File Sharing + Video Calling)
export const metadata: Metadata = {
  title: "Streamlet | Peer-to-Peer File Sharing & Video Calling App",
  description:
    "Streamlet offers real-time peer-to-peer file sharing and HD video calling — all in your browser, with zero downloads and total privacy.",
  keywords:
    "peer-to-peer, file sharing, video calling, WebRTC, secure transfer, HD video, file preview, real-time sharing, online meetings, drag and drop upload, encrypted communication",
  authors: [{ name: "Muhammad Wahaj" }],
  category: "Technology",
  openGraph: {
    title: "Streamlet | Peer-to-Peer File Sharing & Video Calling App",
    description:
      "Experience seamless communication and file transfers with Streamlet. Secure, real-time video calls and instant file sharing with no server uploads.",
    images: [
      {
        url: "/screenshots/streamlet-app.png",
        width: 1920,
        height: 1080,
        alt: "Streamlet app showcasing real-time video call and file sharing interfaces",
      },
    ],
    type: "website",
    siteName: "streamlet",
  },
  robots: {
    index: true,
  },
  themeColor: "#ffffff",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  }
};

export default function AppSeo() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "description": "A modern platform for real-time chat, video calls, and file sharing.",
    name: "Streamlet",
    applicationCategory: "CommunicationApplication",
    operatingSystem: "All",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "2300",
    },
    featureList:
      "Peer-to-peer file sharing, File previews, HD video calls, Secure encryption, Drag & drop upload, Pause/resume/cancel file transfers, Virtual background, Screen sharing",
    screenshot: "https://streamlet.vercel.app/screenshots/streamlet-app.png",
    browserRequirements: "Requires WebRTC support",
  };

  return (
    <>
      <Head>
        {/* Add structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>

      <div className="sr-only" aria-hidden="false">
        <h1>Streamlet — Peer-to-Peer File Sharing & Video Calling</h1>
        <p>
          Streamlet is your all-in-one peer-to-peer platform for instant, private file sharing and high-quality video communication. Whether you need to send a file or start a video call, Streamlet delivers — fast, secure, and server-free.
        </p>

        <h2>Secure Peer-to-Peer File Sharing</h2>
        <p>
          Share files instantly and securely without any server involvement. Connect with a peer and send files directly from your browser using WebRTC-powered technology.
        </p>
        <p>Key features include:</p>
        <ul>
          <li>Real-time progress tracking and estimated time remaining</li>
          <li>Drag-and-drop file uploading with support for all formats</li>
          <li>In-browser previews for images, videos, audio, and text files</li>
          <li>Pause, resume, and cancel transfers with full control</li>
          <li>Access and manage your file sharing history</li>
          <li>100% peer-to-peer with no files ever stored on a server</li>
        </ul>
        <p>
          Perfect for developers, freelancers, educators, and remote teams who need a fast and secure way to share files without hassle.
        </p>

        <h2>Professional Video Conference Solution</h2>
        <p>
          Connect with anyone, anywhere with our high-quality video conferencing platform. No downloads required — just share your unique link and start talking face-to-face instantly.
        </p>
        <p>Our advanced features include:</p>
        <ul>
          <li>Virtual background replacement with AI technology</li>
          <li>One-click screen sharing for presentations</li>
          <li>Multiple camera support for better angles</li>
          <li>Crystal-clear HD audio with noise cancellation</li>
          <li>Secure peer-to-peer connections with encryption</li>
          <li>Works on all devices — desktop, tablet, and mobile</li>
        </ul>
        <p>
          Perfect for remote work, virtual meetings, online education, healthcare consultations, and staying connected with friends and family.
        </p>

        <p>
          One platform. Two powerful tools. No sign-ups, no installations. Just instant sharing and communication — right from your browser.
        </p>
      </div>
    </>
  );
}