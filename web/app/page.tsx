'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { account } from '@/lib/appwrite';
import { fetchRecommendations } from '@/lib/anime-provider';
import Footer from '@/components/Footer';
import type { AniListMedia } from '@/lib/types';

function CarouselStrip({ items, prefix }: { items: AniListMedia[]; prefix: string }) {
  return (
    <div className="flex gap-4 shrink-0" aria-hidden={prefix !== 'a'}>
      {items.map((anime, i) => (
        <div key={`${prefix}-${anime.id}-${i}`} className="flex-shrink-0 w-40 sm:w-44">
          <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium || ''}
              alt={anime.title.english || anime.title.romaji}
              className="absolute inset-0 w-full h-full object-cover opacity-70 hover:opacity-100 hover:scale-105 transition-all duration-300"
              draggable={false}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendingCarousel({ items }: { items: AniListMedia[] }) {
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState('0px');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const imgs = el.querySelectorAll('img');
    if (imgs.length === 0) return;

    let loaded = 0;
    const total = imgs.length;

    function check() {
      loaded++;
      if (loaded >= total) {
        if (trackRef.current) {
          const firstStrip = trackRef.current.children[0] as HTMLElement;
          if (firstStrip) {
            const gap = 16;
            setOffset(`-${firstStrip.offsetWidth + gap}px`);
          }
        }
        setReady(true);
      }
    }

    imgs.forEach((img) => {
      if (img.complete) {
        check();
      } else {
        img.addEventListener('load', check, { once: true });
        img.addEventListener('error', check, { once: true });
      }
    });
  }, [items]);

  return (
    <div className="relative mx-auto pb-12">
      <div ref={containerRef} className={`relative overflow-hidden transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-32 bg-gradient-to-r from-[#0b0e14] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-32 bg-gradient-to-l from-[#0b0e14] to-transparent z-10 pointer-events-none" />
        <div
          ref={trackRef}
          className={`flex gap-4 w-max hover:[animation-play-state:paused] ${ready ? 'carousel-scroll' : ''}`}
          style={{ '--carousel-offset': offset } as React.CSSProperties}
        >
          <CarouselStrip items={items} prefix="a" />
          <CarouselStrip items={items} prefix="b" />
          <CarouselStrip items={items} prefix="c" />
        </div>
      </div>
      <p className="text-center text-xs text-gray-600 mt-4">Trending on AniList right now</p>
    </div>
  );
}

const FEATURES = [
  {
    icon: '📋',
    title: 'Track Your Watchlist',
    description: 'Organize anime with statuses — Watching, Planned, Completed, or Dropped. Never lose track of what you\'re watching.',
  },
  {
    icon: '📅',
    title: 'Airing Schedule',
    description: 'See what\'s airing this week in a clean day-by-day grid. Track new episodes the moment they drop.',
  },
  {
    icon: '🔗',
    title: 'AniList Sync',
    description: 'Already tracking on AniList? Connect your account and import your entire watchlist in one click.',
  },
  {
    icon: '🎵',
    title: 'Shareable Playlists',
    description: 'Curate themed anime collections and share them with friends via a public link.',
  },
  {
    icon: '🧩',
    title: 'Chrome Extension',
    description: 'Quick access from any tab — track anime, get airing notifications, and sync with the web app.',
  },
  {
    icon: '👤',
    title: 'Public Profiles',
    description: 'Share your taste with the world. Show off your watchlist and stats with a shareable profile link.',
  },
];

const STEPS = [
  { number: '1', title: 'Create an account', description: 'Sign up in seconds — or import from AniList' },
  { number: '2', title: 'Add anime', description: 'Search, browse airing schedules, or import your list' },
  { number: '3', title: 'Stay updated', description: 'Track progress, get notifications, share playlists' },
];

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [trending, setTrending] = useState<AniListMedia[]>([]);

  useEffect(() => {
    account.get().then(() => setLoggedIn(true)).catch(() => {});
    fetchRecommendations().then((r) => setTrending(r.trending.slice(0, 8))).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="bg-[#141925]/60 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">
            <Image src="/logo.png" alt="" width={28} height={28} className="rounded" unoptimized />
            Anime Tracker
          </Link>
          <div className="hidden sm:flex gap-1">
            {loggedIn && (
              <>
                <Link href="/watchlist" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors">Watchlist</Link>
                <Link href="/search" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors">Search</Link>
              </>
            )}
            <Link href="/airing" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors">Airing</Link>
            {loggedIn && (
              <>
                <Link href="/playlists" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors">Playlists</Link>
                <Link href="/settings" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors">Settings</Link>
              </>
            )}
          </div>
        </div>
        {loggedIn ? (
          <Link
            href="/watchlist"
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium transition-colors"
          >
            Go to Dashboard
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium transition-colors"
            >
              Sign Up
            </Link>
          </div>
        )}
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden pb-8">
          <div className="absolute inset-0 bg-gradient-to-b from-teal-600/10 via-blue-600/5 to-transparent" />
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

          <div className="relative max-w-4xl mx-auto px-6 py-24 sm:py-32 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-100 leading-tight mb-6">
              Your Anime,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">
                Organized
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
              Track your watchlist, follow airing schedules, sync with AniList, and share curated playlists — all in one place.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {loggedIn ? (
                <Link
                  href="/watchlist"
                  className="px-5 sm:px-8 py-2.5 sm:py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-base sm:text-lg transition-colors"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="px-5 sm:px-8 py-2.5 sm:py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-base sm:text-lg transition-colors"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="/login"
                    className="px-5 sm:px-8 py-2.5 sm:py-3 bg-[#141925] hover:bg-[#1c2333] text-gray-300 rounded-lg font-semibold text-base sm:text-lg border border-[#253040] transition-colors"
                  >
                    Sign In
                  </Link>
                </>
              )}
              <a
                href="https://chromewebstore.google.com/detail/anime-tracker/biidimfpepakgljgokmoiljgakehbhod"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 sm:px-8 py-2.5 sm:py-3 bg-[#141925] hover:bg-[#1c2333] text-gray-300 rounded-lg font-semibold text-base sm:text-lg border border-[#253040] transition-colors inline-flex items-center gap-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                  <line x1="21.17" y1="8" x2="12" y2="8" />
                  <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
                  <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
                </svg>
                Chrome Extension
              </a>
              <a
                href="https://discord.gg/7PFY2Hwb"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 sm:px-8 py-2.5 sm:py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg font-semibold text-base sm:text-lg transition-colors inline-flex items-center gap-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                Join Discord
              </a>
            </div>
          </div>

          {/* Trending preview — inside hero for seamless gradient */}
          {trending.length > 0 && (
            <TrendingCarousel items={trending} />
          )}
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-gray-200 text-center mb-12">
            Everything you need to track anime
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-[#141925]/60 backdrop-blur-sm border border-[#253040] rounded-xl p-6 hover:border-teal-500/30 transition-colors"
              >
                <span className="text-2xl mb-3 block">{f.icon}</span>
                <h3 className="text-lg font-semibold text-gray-200 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-gray-200 text-center mb-12">
            Get started in minutes
          </h2>
          <div className="flex flex-col sm:flex-row gap-8">
            {STEPS.map((step, i) => (
              <div key={step.number} className="flex-1 text-center relative">
                <div className="w-12 h-12 rounded-full bg-teal-600/20 border border-teal-500/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-teal-400 font-bold text-lg">{step.number}</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-200 mb-1">{step.title}</h3>
                <p className="text-xs text-gray-500">{step.description}</p>
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-6 left-[60%] w-[80%] h-px bg-[#253040]" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="bg-gradient-to-br from-teal-600/10 to-blue-600/10 border border-[#253040] rounded-2xl p-10">
            <h2 className="text-2xl font-bold text-gray-200 mb-3">Ready to track your anime?</h2>
            <p className="text-gray-500 mb-6">Join and start organizing your watchlist today.</p>
            {loggedIn ? (
              <Link
                href="/watchlist"
                className="inline-block px-5 sm:px-8 py-2.5 sm:py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/signup"
                className="inline-block px-5 sm:px-8 py-2.5 sm:py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors"
              >
                Create Free Account
              </Link>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
