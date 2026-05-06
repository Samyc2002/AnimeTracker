'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTitle } from '@/lib/useTitle';
import { supabase } from '@/lib/supabase';
import { AuthContext } from '@/lib/auth-context';
import { SfwProvider, useSfw } from '@/lib/sfw-context';
import NavBar from '@/components/NavBar';
import SfwToggle from '@/components/SfwToggle';
import Footer from '@/components/Footer';
import { getTheme } from '@/lib/theme';
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

function StatCard({ label, value, gradient }: { label: string; value: number | string; gradient?: string }) {
  return (
    <div className="bg-[#141925] rounded-lg p-4 text-center border border-[#253040]/50">
      <p className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${gradient || 'from-teal-400 to-blue-400'}`}>
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
  const theme = getTheme(sfwMode);
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
          {profile.avatar ? (
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#253040] mx-auto mb-4">
              <Image src={profile.avatar} alt="" fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${theme.gradientBold} mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-white`}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-100">{displayName}</h1>
          <p className="text-sm text-gray-500 mt-1">Member since {joinedDate}</p>
          {(profile.social_twitter || profile.social_discord || profile.social_instagram || profile.social_reddit) && (
            <div className="flex items-center justify-center gap-3 mt-3">
              {profile.social_twitter && (
                <a href={`https://x.com/${profile.social_twitter}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors" title={`@${profile.social_twitter}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
              )}
              {profile.social_discord && (
                <a href={`https://discord.com/users/${profile.social_discord}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors" title={profile.social_discord}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                </a>
              )}
              {profile.social_instagram && (
                <a href={`https://instagram.com/${profile.social_instagram}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors" title={`@${profile.social_instagram}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                </a>
              )}
              {profile.social_reddit && (
                <a href={`https://reddit.com/user/${profile.social_reddit}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors" title={`u/${profile.social_reddit}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
                </a>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
          <StatCard label="Total Anime" value={sfwWatchlist.length} gradient={theme.gradient} />
          <StatCard label="Watching" value={tabCounts['Watching'] || 0} gradient={theme.gradient} />
          <StatCard label="Completed" value={tabCounts['Completed'] || 0} gradient={theme.gradient} />
          <StatCard label="Planned" value={tabCounts['Planned'] || 0} gradient={theme.gradient} />
          <StatCard label="Dropped" value={tabCounts['Dropped'] || 0} gradient={theme.gradient} />
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {ALL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => updateTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? `${theme.activeTab} text-white`
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

export default function ProfileClient({ profile, selfMode }: { profile: (PublicProfile & { is_public?: boolean; owner_user_id?: string }) | null; selfMode?: boolean }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [selfProfile, setSelfProfile] = useState<PublicProfile | null>(null);
  const [selfLoading, setSelfLoading] = useState(!!selfMode);

  useEffect(() => {
    supabase.auth.getUser()
      .then(async ({ data: { user } }) => {
        setAuthed(!!user);
        if (user && profile?.owner_user_id) {
          setIsOwner(user.id === profile.owner_user_id);
        }
        if (selfMode) {
          if (!user) {
            setSelfLoading(false);
            setAuthLoading(false);
            return;
          }
          const { data } = await supabase
            .from('profiles')
            .select()
            .eq('user_id', user.id)
            .limit(1);
          if (data && data.length > 0) {
            const p = data[0];
            if (p.is_public && p.username) {
              router.replace(`/u/${p.username}`);
              return;
            }
            const res = await fetch(`/api/profiles/self?userId=${user.id}`);
            if (res.ok) {
              setSelfProfile(await res.json());
            }
          }
          setSelfLoading(false);
        }
      })
      .catch(() => {
        setAuthed(false);
        setSelfLoading(false);
      })
      .finally(() => setAuthLoading(false));
  }, [profile?.owner_user_id, selfMode, router]);

  if (authLoading || selfLoading) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#253040] border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (selfMode) {
    if (!authed) {
      return (
        <div className="min-h-screen bg-[#0b0e14] flex flex-col items-center justify-center gap-4">
          <p className="text-gray-400">Sign in to view your profile.</p>
          <Link href="/login" className="text-teal-400 text-sm hover:text-teal-300">Sign in</Link>
        </div>
      );
    }
    if (selfProfile) {
      return (
        <AuthContext.Provider value={{ authed: true, loading: false }}>
          <SfwProvider>
            <AuthedProfileContent profile={selfProfile} />
          </SfwProvider>
        </AuthContext.Provider>
      );
    }
    return (
      <div className="min-h-screen bg-[#0b0e14] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Set up your profile first.</p>
        <Link href="/settings" className="text-teal-400 text-sm hover:text-teal-300">Go to Settings</Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Profile not found.</p>
        <Link href="/" className="text-teal-400 text-sm hover:text-teal-300">Go home</Link>
      </div>
    );
  }

  if (!profile.is_public && !isOwner) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">This profile is private.</p>
        <Link href="/" className="text-teal-400 text-sm hover:text-teal-300">Go home</Link>
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
