import Link from 'next/link';
import Footer from '@/components/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0b0e14]">
      <nav className="bg-[#141925]/60 backdrop-blur-xl border-b border-white/5 px-6 py-3 sticky top-0 z-50">
        <Link href="/" className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">
          Anime Tracker
        </Link>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-200 mb-8">Privacy Policy</h1>
        <div className="space-y-6 text-sm text-gray-400 leading-relaxed">
          <p className="text-xs text-gray-600">Last updated: April 25, 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">Overview</h2>
            <p>
              Anime Tracker (&quot;we&quot;, &quot;our&quot;, &quot;the service&quot;) is a free anime watchlist tracker
              available as a web app at animetracker.lol and a Chrome extension. We are committed to
              protecting your privacy. This policy explains what data we collect and how we use it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">Data We Collect</h2>
            <p className="font-medium text-gray-300 mb-1">Account information (optional)</p>
            <p className="mb-3">
              If you create an account, we store your email address and a hashed password via Appwrite Cloud
              (our authentication provider). This is used solely for authentication and syncing your data
              across devices.
            </p>
            <p className="font-medium text-gray-300 mb-1">Watchlist data</p>
            <p className="mb-3">
              Anime you add to your watchlist, watched episodes, playlists, and notification history.
              This data is stored locally in the Chrome extension and optionally synced to Appwrite Cloud
              if you sign in.
            </p>
            <p className="font-medium text-gray-300 mb-1">AniList connection (optional)</p>
            <p>
              If you connect your AniList account, we store your AniList user ID and an access token to
              import your anime list. This token is stored in your Appwrite profile and is not shared
              with any third party.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">Data We Do NOT Collect</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Browsing history or web activity</li>
              <li>Location data</li>
              <li>Financial or payment information</li>
              <li>Health information</li>
              <li>Personal communications</li>
              <li>Keystroke or click tracking</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To provide watchlist tracking and episode notification features</li>
              <li>To sync your data between the Chrome extension and web app (when signed in)</li>
              <li>To import your anime list from AniList (when connected)</li>
            </ul>
            <p className="mt-2">
              We do not sell, share, or transfer your data to any third party. We do not use your data
              for advertising or analytics beyond basic anonymous usage counts (total users, total entries).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">Third-Party Services</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Appwrite Cloud</strong> — Authentication and database. Data stored on Appwrite&apos;s Singapore servers.</li>
              <li><strong>AniList API</strong> — Anime metadata (titles, images, airing schedules). No user data is sent to AniList unless you connect your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">Chrome Extension</h2>
            <p>
              The Chrome extension stores data locally in <code className="text-teal-400">chrome.storage.local</code>.
              If you sign into the web app while the extension is active, your watchlist data syncs via
              Appwrite Cloud. You can disconnect at any time from the extension settings, and your local
              data remains on your device.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">Data Deletion</h2>
            <p>
              You can delete your account and all associated data at any time by contacting us. Your
              local extension data can be cleared by uninstalling the extension or clearing browser data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">Contact</h2>
            <p>
              For questions about this privacy policy, contact us via GitHub at{' '}
              <a href="https://github.com/Samyc2002/AnimeTracker" className="text-teal-400 hover:text-teal-300">
                github.com/Samyc2002/AnimeTracker
              </a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
