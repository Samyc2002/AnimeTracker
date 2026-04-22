import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0d13]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold text-teal-400">
            Anime Tracker
          </Link>

          <div className="flex items-center gap-6 text-sm">
            <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/airing" className="text-gray-500 hover:text-gray-300 transition-colors">Airing Schedule</Link>
            <Link href="/login" className="text-gray-500 hover:text-gray-300 transition-colors">Sign In</Link>
            <a
              href="#"
              className="hidden text-gray-500 hover:text-gray-300 transition-colors"
              data-extension-link
            >
              Chrome Extension
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
