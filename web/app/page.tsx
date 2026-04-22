'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { account } from '@/lib/appwrite';
import { fetchRecommendations } from '@/lib/anilist';
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
      <nav className="bg-[#141925]/60 backdrop-blur-xl border-b border-white/5 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="text-lg font-bold text-teal-400">
          Anime Tracker
        </Link>
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
            <div className="flex items-center justify-center gap-4">
              {loggedIn ? (
                <Link
                  href="/watchlist"
                  className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-lg transition-colors"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-lg transition-colors"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="/login"
                    className="px-8 py-3 bg-[#141925] hover:bg-[#1c2333] text-gray-300 rounded-lg font-semibold text-lg border border-[#253040] transition-colors"
                  >
                    Sign In
                  </Link>
                </>
              )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                className="inline-block px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/signup"
                className="inline-block px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors"
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
