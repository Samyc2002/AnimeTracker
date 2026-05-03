'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Query } from 'appwrite';
import { account, databases, DATABASE_ID, NOTIFICATIONS_COLLECTION_ID, PROFILES_COLLECTION_ID } from '@/lib/appwrite';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const navItems = loading ? [] : authed ? authNavItems : publicNavItems;

  useEffect(() => {
    if (!authed) return;
    async function loadUnread() {
      try {
        const user = await account.get();
        const res = await databases.listDocuments(DATABASE_ID, NOTIFICATIONS_COLLECTION_ID, [
          Query.equal('user_id', user.$id),
          Query.equal('is_read', false),
          Query.limit(1),
        ]);
        setUnreadCount(res.total);
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
        const user = await account.get();
        const res = await databases.listDocuments(DATABASE_ID, PROFILES_COLLECTION_ID, [
          Query.equal('user_id', user.$id),
          Query.select(['username']),
          Query.limit(1),
        ]);
        if (res.documents.length > 0) {
          const username = res.documents[0].username as string | undefined;
          if (username) setProfileUsername(username);
        }
      } catch {
        // Not critical
      }
    }
    loadProfile();
  }, [authed]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    localStorage.removeItem('anime_tracker_ext_jwt');
    await account.deleteSession('current');
    router.push('/');
  }

  return (
    <nav ref={mobileMenuRef} className="relative bg-[#141925]/60 backdrop-blur-xl border-b border-white/5 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Left side: Logo + desktop nav links */}
      <div className="flex items-center gap-6">
        <Link href="/" className={`flex items-center gap-2 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient}`}>
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded" unoptimized />
          Anime Tracker
        </Link>
        <div className="hidden sm:flex gap-1">
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
      <div className="hidden sm:flex items-center gap-3">
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

      {/* Mobile hamburger button */}
      <button
        className="sm:hidden p-1.5 rounded text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileMenuOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#141925] border-b border-white/5 px-6 py-4 sm:hidden">
          {/* Nav links */}
          <div className="flex flex-col gap-1">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === href
                    ? `${theme.activeTab} text-white`
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1c2333]'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {authed && (
            <>
              <div className="border-t border-[#253040] my-2" />
              {/* Notifications */}
              <Link
                href="/notifications"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === '/notifications'
                    ? `${theme.activeTab} text-white`
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1c2333]'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              {/* Profile */}
              <Link
                href={profileUsername ? `/u/${profileUsername}` : '/settings'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {profileUsername ? 'View Profile' : 'Set Up Profile'}
              </Link>
            </>
          )}

          <div className="border-t border-[#253040] my-2" />

          {/* SFW toggle */}
          <div className="px-3 py-2">
            <SfwToggle sfwMode={sfwMode} onToggle={() => setSfwMode(!sfwMode)} />
          </div>

          {/* Sign in / Sign out */}
          {!loading && (
            <>
              <div className="border-t border-[#253040] my-2" />
              {authed ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${theme.link} hover:bg-[#1c2333] transition-colors`}
                >
                  Sign In
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </nav>
  );
}
