'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, PROFILES_COLLECTION_ID, WATCHLIST_COLLECTION_ID, WATCHED_EPISODES_COLLECTION_ID } from '@/lib/appwrite';
import { fetchUserList, mediaToWatchlistEntry } from '@/lib/anilist';
import RequireAuth from '@/components/RequireAuth';

interface ProfileDoc {
  $id: string;
  display_language: string;
  anilist_user_id?: number;
  anilist_token?: string;
}

export default function SettingsPageGuarded() {
  return <RequireAuth><SettingsPage /></RequireAuth>;
}

function SettingsPage() {
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState('English');
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [profileDocId, setProfileDocId] = useState<string | null>(null);
  const [anilistConnected, setAnilistConnected] = useState(false);
  const [anilistUserId, setAnilistUserId] = useState<number | null>(null);
  const [anilistToken, setAnilistToken] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const anilistParam = searchParams.get('anilist');
    if (anilistParam === 'connected') {
      setToast('AniList account connected successfully!');
      window.history.replaceState({}, '', '/settings');
    } else if (anilistParam === 'error') {
      setToast('Failed to connect AniList. Please try again.');
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    async function load() {
      const user = await account.get();
      setEmail(user.email);
      setUserId(user.$id);

      const profiles = await databases.listDocuments(DATABASE_ID, PROFILES_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.limit(1),
      ]);

      if (profiles.documents.length > 0) {
        const profile = profiles.documents[0] as unknown as ProfileDoc;
        setLanguage(profile.display_language);
        setProfileDocId(profile.$id);
        if (profile.anilist_user_id && profile.anilist_token) {
          setAnilistConnected(true);
          setAnilistUserId(profile.anilist_user_id);
          setAnilistToken(profile.anilist_token);
        }
      } else {
        const newProfile = await databases.createDocument(DATABASE_ID, PROFILES_COLLECTION_ID, ID.unique(), {
          user_id: user.$id,
          display_language: 'English',
        });
        setProfileDocId(newProfile.$id);
      }
    }
    load();
  }, []);

  async function saveLanguage(value: string) {
    setLanguage(value);
    if (!profileDocId) return;
    setSaving(true);
    await databases.updateDocument(DATABASE_ID, PROFILES_COLLECTION_ID, profileDocId, {
      display_language: value,
    });
    setSaving(false);
  }

  function connectAniList() {
    const clientId = process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID;
    if (!clientId) {
      setToast('AniList client ID not configured');
      return;
    }
    const redirectUri = `${window.location.origin}/api/auth/anilist/callback`;
    const url = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${userId}`;
    window.location.href = url;
  }

  async function disconnectAniList() {
    if (!profileDocId) return;
    await databases.updateDocument(DATABASE_ID, PROFILES_COLLECTION_ID, profileDocId, {
      anilist_user_id: null,
      anilist_token: null,
    });
    setAnilistConnected(false);
    setAnilistUserId(null);
    setAnilistToken(null);
    setToast('AniList disconnected');
  }

  async function importWatchlist() {
    if (!anilistUserId || !anilistToken) return;
    setImporting(true);
    setImportResult(null);

    try {
      const user = await account.get();
      const anilistEntries = await fetchUserList(anilistUserId, anilistToken);

      const existing = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.select(['media_id', '$id']),
        Query.limit(500),
      ]);
      const existingMap = new Map(
        existing.documents.map((d) => [(d as unknown as { media_id: number }).media_id, d.$id])
      );

      let created = 0;
      let updated = 0;

      for (const entry of anilistEntries) {
        const docData = {
          ...mediaToWatchlistEntry(entry.media),
          user_id: user.$id,
          watch_status: entry.watchStatus,
        };

        const existingDocId = existingMap.get(entry.media.id);

        if (existingDocId) {
          await databases.updateDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, existingDocId, docData);
          updated++;
        } else {
          await databases.createDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, ID.unique(), docData);
          created++;
        }

        if (entry.progress > 0) {
          const watchedRes = await databases.listDocuments(DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, [
            Query.equal('user_id', user.$id),
            Query.equal('media_id', entry.media.id),
            Query.limit(5000),
          ]);
          const watchedEps = new Set(
            watchedRes.documents.map((d) => (d as unknown as { episode_number: number }).episode_number)
          );

          for (let ep = 1; ep <= entry.progress; ep++) {
            if (!watchedEps.has(ep)) {
              await databases.createDocument(DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, ID.unique(), {
                user_id: user.$id,
                media_id: entry.media.id,
                episode_number: ep,
              });
            }
          }
        }
      }

      setImportResult(`Imported ${created} new, updated ${updated} existing anime.`);
    } catch (err) {
      setImportResult(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setImporting(false);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-200 mb-6">Settings</h1>

      {toast && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-teal-600/20 border border-teal-500/30 text-teal-300 text-sm">
          {toast}
        </div>
      )}

      <div className="space-y-8 max-w-md">
        <div>
          <p className="text-sm text-gray-400 mb-1">Signed in as</p>
          <p className="text-gray-200">{email}</p>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-gray-300">Title language</label>
          <select
            value={language}
            onChange={(e) => saveLanguage(e.target.value)}
            className="px-3 py-1.5 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm"
          >
            <option value="English">English</option>
            <option value="Japanese">Japanese</option>
          </select>
        </div>

        {saving && <p className="text-xs text-gray-500">Saving...</p>}

        <div className="border-t border-[#253040] pt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">AniList Integration</h2>

          {anilistConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-sm text-gray-300">
                  Connected as AniList user <span className="text-teal-400 font-medium">#{anilistUserId}</span>
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={importWatchlist}
                  disabled={importing}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
                >
                  {importing ? 'Importing...' : 'Import Watchlist'}
                </button>
                <button
                  onClick={disconnectAniList}
                  className="px-4 py-2 bg-[#141925] hover:bg-[#1c2333] text-gray-300 text-sm rounded-lg border border-[#253040] transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {importResult && (
                <p className="text-xs text-gray-400">{importResult}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                Connect your AniList account to import your anime watchlist.
              </p>
              <button
                onClick={connectAniList}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium transition-colors"
              >
                Connect AniList
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
