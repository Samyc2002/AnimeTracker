import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0d13]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">
            <Image src="/logo.png" alt="" width={24} height={24} className="rounded" unoptimized />
            Anime Tracker
          </Link>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-6 text-sm">
            <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/airing" className="text-gray-500 hover:text-gray-300 transition-colors">Airing Schedule</Link>
            {/* <Link href="/login" className="text-gray-500 hover:text-gray-300 transition-colors">Sign In</Link> */}
            <Link href="/privacy" className="text-gray-500 hover:text-gray-300 transition-colors">Privacy</Link>
            <a
              href="https://chromewebstore.google.com/detail/anime-tracker/biidimfpepakgljgokmoiljgakehbhod"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              Chrome Extension
            </a>
            <a
              href="https://discord.gg/AtDUykhnG4"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              Discord
            </a>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-700">
          &copy; {new Date().getFullYear()} Anime Tracker. Data from AniList.
        </div>
      </div>
    </footer>
  );
}
