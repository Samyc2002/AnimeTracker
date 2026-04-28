'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTitle } from '@/lib/useTitle';
import { account } from '@/lib/appwrite';
import { AuthContext } from '@/lib/auth-context';
import { SfwProvider, useSfw } from '@/lib/sfw-context';
import NavBar from '@/components/NavBar';
import SfwToggle from '@/components/SfwToggle';
import Footer from '@/components/Footer';
import type { PublicProfile, PublicProfileEntry, WatchStatus } from '@/lib/types';

const WATCH_STATUSES: WatchStatus[] = ['Watching', 'Completed', 'Planned', 'Dropped'];
const ALL_TABS = ['All', ...WATCH_STATUSES] as const;

const statusColors: Record<WatchStatus, string> = {
  Watching: 'bg-emerald-900/60 text-emerald-300',
  Planned: 'bg-blue-900/60 text-blue-300',
  Completed: 'bg-purple-900/60 text-purple-300',
  Dropped: 'bg-red-900/60 text-red-300',
};

function upgradeImageUrl(url: string): string {
  return url.replace(/\/(?:small|medium)\//, '/large/');
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[#141925] rounded-lg p-4 text-center border border-[#253040]/50">
      <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function AnimeGrid({ entries }: { entries: PublicProfileEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-gray-500 text-center py-8">No anime in this category.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {entries.map((entry) => {
        const title = entry.title_english || entry.title_romaji || 'Unknown';
        return (
          <Link
            key={entry.media_id}
            href={`/anime/${entry.media_id}`}
            className={`bg-[#141925] rounded-lg overflow-hidden hover:bg-[#1c2333] transition-colors group ${entry.is_nsfw ? 'border border-red-500/40' : ''}`}
          >
            <div className="relative w-full aspect-[3/4]">
              <Image
                src={upgradeImageUrl(entry.cover_url)}
                alt={title}
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${statusColors[entry.watch_status]}`}>
                  {entry.watch_status}
                </span>
              </div>
            </div>
            <div className="p-2">
              <p className="text-xs font-medium text-gray-200 truncate" title={title}>{title}</p>
              {entry.total_episodes && (
                <p className="text-[10px] text-gray-500 mt-0.5">{entry.total_episodes} eps</p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function GuestNav({ sfwMode, onToggleSfw }: { sfwMode: boolean; onToggleSfw: () => void }) {
  return (
    <nav className="bg-[#141925]/60 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">
        <Image src="/logo.png" alt="" width={28} height={28} className="rounded" unoptimized />
        Anime Tracker
      </Link>
      <div className="flex items-center gap-3">
        <SfwToggle sfwMode={sfwMode} onToggle={onToggleSfw} />
        <Link
          href="/login"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </nav>
  );
}

function AuthedProfileContent({ profile }: { profile: PublicProfile }) {
  const { sfwMode } = useSfw();
  return <ProfileView profile={profile} sfwMode={sfwMode} authed />;
}

function GuestProfileContent({ profile }: { profile: PublicProfile }) {
  const [sfwMode, setSfwMode] = useState(true);
  return <ProfileView profile={profile} sfwMode={sfwMode} authed={false} onToggleSfw={() => setSfwMode((p) => !p)} />;
}

function ProfileView({ profile, sfwMode, authed, onToggleSfw }: { profile: PublicProfile; sfwMode: boolean; authed: boolean; onToggleSfw?: () => void }) {
  useTitle(`Profile | ${profile.display_name || profile.username}`);

  const [activeTab, setActiveTab] = useState<WatchStatus | 'All'>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('status');
      if (param && (ALL_TABS as readonly string[]).includes(param)) return param as WatchStatus;
    }
    return 'All';
  });

  function updateTab(tab: WatchStatus | 'All') {
    setActiveTab(tab);
    const p = new URLSearchParams(window.location.search);
    if (tab === 'All') p.delete('status');
    else p.set('status', tab);
    const qs = p.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? '?' + qs : ''}`);
  }

  const displayName = profile.display_name || profile.username;
  const joinedDate = new Date(profile.joined_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const sfwWatchlist = sfwMode
    ? profile.watchlist.filter((e) => !e.is_nsfw)
    : profile.watchlist;

  const filteredWatchlist =
    activeTab === 'All'
      ? sfwWatchlist
      : sfwWatchlist.filter((e) => e.watch_status === activeTab);

  const tabCounts: Record<string, number> = {
    All: sfwWatchlist.length,
    ...Object.fromEntries(
      WATCH_STATUSES.map((s) => [s, sfwWatchlist.filter((e) => e.watch_status === s).length])
    ),
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col">
      {authed ? <NavBar /> : <GuestNav sfwMode={sfwMode} onToggleSfw={onToggleSfw!} />}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-gray-100">{displayName}</h1>
          <p className="text-sm text-gray-500 mt-1">Member since {joinedDate}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
          <StatCard label="Total Anime" value={sfwWatchlist.length} />
          <StatCard label="Watching" value={tabCounts['Watching'] || 0} />
          <StatCard label="Completed" value={tabCounts['Completed'] || 0} />
          <StatCard label="Planned" value={tabCounts['Planned'] || 0} />
          <StatCard label="Dropped" value={tabCounts['Dropped'] || 0} />
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {ALL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => updateTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-teal-600 text-white'
                  : 'bg-[#141925] text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab} <span className="text-xs opacity-60">({tabCounts[tab] || 0})</span>
            </button>
          ))}
        </div>

        <AnimeGrid entries={filteredWatchlist} />
      </main>

      <Footer />
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    account.get()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/profiles/${encodeURIComponent(username)}`);
        if (!res.ok) {
          setError(res.status === 404 ? 'Profile not found' : 'Failed to load profile');
          setLoading(false);
          return;
        }
        setProfile(await res.json());
        setError(null);
      } catch {
        setError('Failed to load profile');
      }
      setLoading(false);
    }
    load();
  }, [username]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#253040] border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">{error || 'Profile not found'}</p>
        <Link href="/signup" className="text-teal-400 text-sm hover:text-teal-300">
          Create your own profile
        </Link>
      </div>
    );
  }

  if (authed) {
    return (
      <AuthContext.Provider value={{ authed: true, loading: false }}>
        <SfwProvider>
          <AuthedProfileContent profile={profile} />
        </SfwProvider>
      </AuthContext.Provider>
    );
  }

  return <GuestProfileContent profile={profile} />;
}
