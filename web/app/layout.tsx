import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Anime Tracker — Track, Sync, Share",
    template: "%s | Anime Tracker",
  },
  description: "Track your anime watchlist, follow airing schedules, sync with AniList, and share curated playlists — all in one place.",
  metadataBase: new URL("https://animetracker.lol"),
  openGraph: {
    title: "Anime Tracker — Track, Sync, Share",
    description: "Track your anime watchlist, follow airing schedules, sync with AniList, and share curated playlists — all in one place.",
    url: "https://animetracker.lol",
    siteName: "Anime Tracker",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Anime Tracker — Track, Sync, Share",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Tracker — Track, Sync, Share",
    description: "Track your anime watchlist, follow airing schedules, sync with AniList, and share curated playlists.",
    images: ["/api/og"],
  },
  icons: {
    icon: "/icon.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0b0e14] text-gray-200">{children}</body>
    </html>
  );
}
