'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { account } from '@/lib/appwrite';

const navItems = [
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/search', label: 'Search' },
  { href: '/airing', label: 'Airing' },
  { href: '/settings', label: 'Settings' },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    localStorage.removeItem('anime_tracker_ext_jwt');
    await account.deleteSession('current');
    router.push('/login');
  }

  return (
    <nav className="bg-[#16213e] border-b border-[#2a2a4a] px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/watchlist" className="text-lg font-bold text-purple-400">
          Anime Tracker
        </Link>
        <div className="flex gap-1">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1e2d4d]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="text-sm text-gray-400 hover:text-gray-200"
      >
        Sign out
      </button>
    </nav>
  );
}
