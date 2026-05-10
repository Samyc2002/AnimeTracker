import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SnackbarProvider from "@/components/SnackbarProvider";
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
  verification: {
    google: 'g6I5v5VPbkiZRtiXMyJe49iW3HmWB2M97dr13WapfLM',
    other: { 'msvalidate.01': '075F536179EC3BAC042BC7A940C32973' },
  },
  metadataBase: new URL('https://www.animetracker.lol'),
  title: {
    default: 'Anime Tracker: Smart Recs, Buddy System & Airing Alerts',
    template: '%s | Anime Tracker',
  },
  description: 'Free anime tracker with smart recommendations, buddy system, sequel alerts, and a Chrome extension. AniList import. No ads, no feature locks.',
  keywords: ['anime tracker', 'anime watchlist', 'MAL alternative', 'AniList alternative', 'anime recommendations', 'anime chrome extension', 'sequel alerts', 'anime buddy'],
  openGraph: {
    type: 'website',
    siteName: 'Anime Tracker',
    title: 'Anime Tracker: Smart Recs, Buddy System & Airing Alerts',
    description: 'Free anime tracker with smart recommendations, buddy system, sequel alerts, and a Chrome extension. AniList import. No ads, no feature locks.',
    url: 'https://www.animetracker.lol',
    locale: 'en_US',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Anime Tracker' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anime Tracker: Smart Recs, Buddy System & Airing Alerts',
    description: 'Free anime tracker with smart recommendations, buddy system, sequel alerts, and a Chrome extension. AniList import. No ads, no feature locks.',
    images: ['/og.png'],
  },
  alternates: {
    canonical: 'https://www.animetracker.lol',
  },
  icons: {
    icon: '/icon.png',
    apple: '/logo.png',
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
      <body className="min-h-full flex flex-col bg-[#0b0e14] text-gray-200">
        <SnackbarProvider>
          {children}
        </SnackbarProvider>
      </body>
    </html>
  );
}
