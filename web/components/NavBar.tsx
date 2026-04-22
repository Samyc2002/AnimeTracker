'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { account } from '@/lib/appwrite';
import { useSfw } from '@/lib/sfw-context';
import { useAuth } from '@/app/(dashboard)/layout';

const publicNavItems = [
  { href: '/airing', label: 'Airing' },
];

const authNavItems = [
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/search', label: 'Search' },
  { href: '/airing', label: 'Airing' },
  { href: '/playlists', label: 'Playlists' },
  { href: '/settings', label: 'Settings' },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sfwMode, setSfwMode } = useSfw();
  const { authed, loading } = useAuth();

  const navItems = loading ? [] : authed ? authNavItems : publicNavItems;

  async function handleSignOut() {
    localStorage.removeItem('anime_tracker_ext_jwt');
    await account.deleteSession('current');
    router.push('/');
  }

  return (
    <nav className="bg-[#141925]/60 backdrop-blur-xl border-b border-white/5 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-bold text-teal-400">
          Anime Tracker
        </Link>
        <div className="flex gap-1">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-teal-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1c2333]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSfwMode(!sfwMode)}
          className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
            sfwMode
              ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30'
              : 'bg-red-600/20 text-red-400 border border-red-500/30'
          }`}
        >
          {sfwMode ? 'SFW' : 'NSFW'}
        </button>
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
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium transition-colors"
          >
            Sign In
          </Link>
        ))}
      </div>
    </nav>
  );
}
