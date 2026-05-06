'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import SfwToggle from '@/components/SfwToggle';
import { useAuth } from '@/lib/auth-context';

const publicNavItems = [
  { href: '/airing', label: 'Airing' },
];

const authNavItems = [
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/search', label: 'Search' },
  { href: '/recommend', label: 'For You' },
  { href: '/airing', label: 'Airing' },
  { href: '/playlists', label: 'Playlists' },
  { href: '/buddies', label: 'Buddies' },
  { href: '/settings', label: 'Settings' },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sfwMode, setSfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const { authed, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const navItems = loading ? [] : authed ? authNavItems : publicNavItems;

  useEffect(() => {
    if (!authed) return;
    async function loadUnread() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
        setUnreadCount(count ?? 0);
      } catch {
        // Not critical
      }
    }
    loadUnread();
    const interval = setInterval(loadUnread, 60_000);
    return () => clearInterval(interval);
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', user.id)
          .limit(1);
        if (data && data.length > 0 && data[0].username) setProfileUsername(data[0].username);
      } catch {
        // Not critical
      }
    }
    loadProfile();
  }, [authed]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    localStorage.removeItem('anime_tracker_ext_jwt');
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <>
    <nav className="relative bg-[#0b0e14]/40 backdrop-blur-xl border-b border-white/5 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Left side: Logo + desktop nav links */}
      <div className="flex items-center gap-6">
        <Link href="/" className={`flex items-center gap-2 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient}`}>
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded" unoptimized />
          Anime Tracker
        </Link>
        <div className="hidden xl:flex gap-1">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === href
                  ? `${theme.activeTab} text-white`
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1c2333]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Right side: desktop controls */}
      <div className="hidden xl:flex items-center gap-3">
        {authed && (
          <>
            <Link
              href="/notifications"
              className={`relative p-1.5 rounded transition-colors ${
                pathname === '/notifications'
                  ? `${theme.activeTab} text-white`
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1c2333]'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link
              href={profileUsername ? `/u/${profileUsername}` : '/settings'}
              className="p-1.5 rounded text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors"
              title={profileUsername ? `View profile` : 'Set up profile'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>
          </>
        )}
        <SfwToggle sfwMode={sfwMode} onToggle={() => setSfwMode(!sfwMode)} />
        {!loading && (authed ? (
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            Sign out
          </button>
        ) : (
          <Link
            href="/login"
            className={`px-3 py-1.5 ${theme.btn} text-white text-sm rounded-lg font-medium transition-colors`}
          >
            Sign In
          </Link>
        ))}
      </div>

      {/* Mobile: Sign In button only (no hamburger) */}
      {!loading && !authed && (
        <Link
          href="/login"
          className={`xl:hidden px-3 py-1.5 ${theme.btn} text-white text-sm rounded-lg font-medium transition-colors`}
        >
          Sign In
        </Link>
      )}
    </nav>

    {/* Mobile bottom navigation bar */}
    {authed && (
      <nav className="fixed bottom-0 inset-x-0 z-50 xl:hidden bg-[#141925]/60 backdrop-blur-xl border-t border-white/5 h-14 flex items-center justify-around px-2 safe-bottom">
        {[
          { href: '/watchlist', label: 'Watchlist', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )},
          { href: '/search', label: 'Search', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )},
          { href: '/airing', label: 'Airing', icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          )},
          { href: '/notifications', label: 'Alerts', icon: (
            <div className="relative">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
          )},
        ].map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors ${
              pathname === href ? `${theme.btnText}` : 'text-gray-500'
            }`}
          >
            {icon}
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors ${
            moreOpen ? `${theme.btnText}` : 'text-gray-500'
          }`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
          </svg>
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    )}

    {/* More bottom sheet */}
    {moreOpen && (
      <>
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm xl:hidden" onClick={() => setMoreOpen(false)} />
        <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up xl:hidden">
          <div className="bg-[#141925] rounded-t-2xl border-t border-x border-[#253040] mx-auto max-w-lg">
            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-2" />
            <div className="px-4 pb-4 space-y-1">
              {[
                { href: '/recommend', label: 'For You', icon: '✦' },
                { href: '/playlists', label: 'Playlists', icon: '▶' },
                { href: '/buddies', label: 'Buddies', icon: '♥' },
                { href: profileUsername ? `/u/${profileUsername}` : '/settings', label: profileUsername ? 'Profile' : 'Set Up Profile', icon: '●' },
                { href: '/settings', label: 'Settings', icon: '⚙' },
              ].map(({ href, label, icon }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === href
                      ? `${theme.activeTab} text-white`
                      : 'text-gray-300 hover:bg-[#1c2333]'
                  }`}
                >
                  <span className="w-5 text-center text-gray-500">{icon}</span>
                  {label}
                </Link>
              ))}

              <div className="border-t border-[#253040] my-2" />

              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm font-medium text-gray-300">SFW Mode</span>
                <SfwToggle sfwMode={sfwMode} onToggle={() => setSfwMode(!sfwMode)} />
              </div>

              <div className="border-t border-[#253040] my-2" />

              <button
                onClick={() => {
                  setMoreOpen(false);
                  handleSignOut();
                }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-[#1c2333] transition-colors"
              >
                <span className="w-5 text-center">↪</span>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}
