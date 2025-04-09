import { Metadata } from "next";
import Head from "next/head";

// Define metadata for SEO
export const metadata: Metadata = {
  title: "Video Conference | Connect with Anyone, Anywhere in Real-Time",
  description:
    "Professional video conferencing with HD quality, virtual backgrounds, screen sharing, and secure connections. Join meetings on any device without downloads.",
  keywords:
    "video conference, video call, background removal, screen sharing, virtual meeting, webRTC, peer-to-peer, secure video call, HD video conferencing, remote meetings",
  authors: [{ name: "Muhammad Wahaj" }],
  category: "Technology",
  openGraph: {
    title: "Video Conference | Connect with Anyone, Anywhere in Real-Time",
    description:
      "Professional video conferencing with HD quality, virtual backgrounds, screen sharing, and secure connections. Join meetings on any device without downloads.",
    images: [
      {
        url: "/screenshots/video-call.png",
        width: 1920,
        height: 1080,
        alt: "Video conferencing app showing a real-time meeting interface",
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
  // JSON-LD structured data for VideoObject
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Video Conference Application",
    applicationCategory: "CommunicationApplication",
    operatingSystem: "All",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "1024",
    },
    featureList:
      "Background removal, Screen sharing, Virtual backgrounds, HD video quality, Secure connections",
    screenshot: "https://streamlet.vercel.app/screenshots/video-call.png",
    browserRequirements: "Requires WebRTC support",
  };

  return (
    <>
      <Head>
        {/* Preload critical assets */}
        <link rel="preload" href="/background/livingroom.jpg" as="image" />
        <link rel="preload" href="/background/office.jpg" as="image" />
        <link rel="preload" href="/background/workspace.jpg" as="image" />
        <link rel="preload" href="/background/workspace2.jpg" as="image" />

        {/* Add structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>

      <div className="sr-only" aria-hidden="false">
        <h1>Professional Video Conference Solution</h1>
        <p>
          Connect with anyone, anywhere with our high-quality video conferencing
          platform. No downloads required - just share your unique link and
          start talking face-to-face instantly.
        </p>
        <p>Our advanced features include:</p>
        <ul>
          <li>Virtual background replacement with AI technology</li>
          <li>One-click screen sharing for presentations</li>
          <li>Multiple camera support for better angles</li>
          <li>Crystal-clear HD audio with noise cancellation</li>
          <li>Secure peer-to-peer connections with encryption</li>
          <li>Works on all devices - desktop, tablet and mobile</li>
        </ul>
        <p>
          Perfect for remote work, virtual meetings, online education,
          healthcare consultations, and staying connected with friends and
          family.
        </p>
      </div>
    </>
  );
}
