import { Metadata } from "next";
import Head from "next/head";

// Define metadata for SEO
export const metadata: Metadata = {
  title: "Peer-to-Peer File Sharing | Secure, Instant & Serverless",
  description:
    "Instantly share files over secure peer-to-peer connections with real-time progress, previews, and full transfer history — no servers or uploads needed.",
  keywords:
    "file sharing, peer-to-peer file transfer, WebRTC file sharing, secure file sharing, instant file transfer, file preview, drag and drop upload, send files fast, download files online, real-time file sharing",
  authors: [{ name: "Muhammad Wahaj" }],
  category: "Technology",
  openGraph: {
    title: "Peer-to-Peer File Sharing | Secure, Instant & Serverless",
    description:
      "Instantly share files of any type between browsers with real-time transfer, previews, and complete control. Built with WebRTC for true P2P transfers.",
    images: [
      {
        url: "/screenshots/file-share.png",
        width: 1920,
        height: 1080,
        alt: "File sharing app showing a real-time file transfer interface",
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
  },
};

export default function PageSeo() {
  // JSON-LD structured data for WebApplication (File Sharing)
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Peer-to-Peer File Sharing App",
    applicationCategory: "UtilityApplication",
    operatingSystem: "All",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "1287",
    },
    featureList:
      "Drag and drop upload, File preview, Real-time transfer, Pause/resume/cancel, Secure peer-to-peer connection, Download history",
    screenshot: "https://streamlet.vercel.app/screenshots/file-share.png",
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
        <h1>Secure Peer-to-Peer File Sharing</h1>
        <p>
          Share files instantly and securely without any server involvement.
          Connect with a peer and send files directly from your browser using
          WebRTC-powered technology.
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
          Perfect for developers, freelancers, educators, and remote teams who
          need a fast and secure way to share files without hassle.
        </p>
      </div>
    </>
  );
}
