'use client';

import { useTitle } from '@/lib/useTitle';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, PROFILES_COLLECTION_ID, WATCHLIST_COLLECTION_ID, WATCHED_EPISODES_COLLECTION_ID } from '@/lib/appwrite';
import { fetchUserList, mediaToWatchlistEntry } from '@/lib/anime-provider';
import RequireAuth from '@/components/RequireAuth';
import DatabaseSeed from '@/components/DatabaseSeed';
import { enqueueSnackbar } from 'notistack';

interface ProfileDoc {
  $id: string;
  display_language: string;
  anilist_user_id?: number;
  anilist_token?: string;
  username?: string;
  display_name?: string;
  is_public?: boolean;
  hide_nsfw_public?: boolean;
}

export default function SettingsPageGuarded() {
  return <RequireAuth><SettingsPage /></RequireAuth>;
}

function SettingsPage() {
  useTitle('Settings');
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
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [hideNsfwPublic, setHideNsfwPublic] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const anilistParam = searchParams.get('anilist');
    if (anilistParam === 'connected') {
      enqueueSnackbar('AniList account connected successfully!', { variant: 'success' });
      window.history.replaceState({}, '', '/settings');
    } else if (anilistParam === 'error') {
      enqueueSnackbar('Failed to connect AniList. Please try again.', { variant: 'error' });
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

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
        if (profile.username) setUsername(profile.username);
        if (profile.display_name) setDisplayName(profile.display_name);
        if (profile.is_public) setIsPublic(profile.is_public);
        if (profile.hide_nsfw_public) setHideNsfwPublic(profile.hide_nsfw_public);
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
    enqueueSnackbar('Language updated', { variant: 'success' });
  }

  function connectAniList() {
    const clientId = process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID;
    if (!clientId) {
      enqueueSnackbar('AniList client ID not configured', { variant: 'error' });
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
    enqueueSnackbar('AniList disconnected', { variant: 'success' });
  }

  function validateUsername(value: string): string | null {
    if (!value) return null;
    if (value.length < 3) return 'Must be at least 3 characters';
    if (value.length > 32) return 'Must be 32 characters or fewer';
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value) && value.length >= 3) {
      return 'Only lowercase letters, numbers, and hyphens (cannot start/end with hyphen)';
    }
    return null;
  }

  async function saveProfile() {
    if (!profileDocId) return;
    const validationErr = validateUsername(username);
    if (username && validationErr) {
      setUsernameError(validationErr);
      return;
    }
    setUsernameError(null);
    setSavingProfile(true);

    try {
      if (username) {
        const existing = await databases.listDocuments(DATABASE_ID, PROFILES_COLLECTION_ID, [
          Query.equal('username', username),
          Query.limit(1),
        ]);
        if (existing.documents.length > 0 && existing.documents[0].$id !== profileDocId) {
          setUsernameError('Username is already taken');
          setSavingProfile(false);
          return;
        }
      }

      await databases.updateDocument(DATABASE_ID, PROFILES_COLLECTION_ID, profileDocId, {
        username: username || null,
        display_name: displayName || null,
        is_public: isPublic,
        hide_nsfw_public: hideNsfwPublic,
      });
      enqueueSnackbar('Profile saved!', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`, { variant: 'error' });
    }
    setSavingProfile(false);
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
      enqueueSnackbar(`Imported ${created} new, updated ${updated} existing anime`, { variant: 'success' });
    } catch (err) {
      setImportResult(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setImporting(false);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-200 mb-6">Settings</h1>

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

        <div className="border-t border-[#253040] pt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Public Profile</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-300 block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  setUsernameError(null);
                }}
                placeholder="your-username"
                maxLength={32}
                className="w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm placeholder:text-gray-600 focus:border-teal-500/50 focus:outline-none"
              />
              {usernameError && (
                <p className="text-xs text-red-400 mt-1">{usernameError}</p>
              )}
              {username && !usernameError && (
                <p className="text-xs text-gray-600 mt-1">animetracker.lol/u/{username}</p>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-300 block mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you want to be shown"
                maxLength={64}
                className="w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm placeholder:text-gray-600 focus:border-teal-500/50 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-300">Make profile public</label>
                <p className="text-xs text-gray-600">Others can see your watchlist and stats</p>
              </div>
              <button
                onClick={() => setIsPublic(!isPublic)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isPublic ? 'bg-teal-600' : 'bg-[#253040]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    isPublic ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-300">Hide NSFW from public profile</label>
                <p className="text-xs text-gray-600">NSFW anime will never appear on your public profile</p>
              </div>
              <button
                onClick={() => setHideNsfwPublic(!hideNsfwPublic)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  hideNsfwPublic ? 'bg-teal-600' : 'bg-[#253040]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    hideNsfwPublic ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {isPublic && username && (
              <div className="flex items-center gap-2 px-3 py-2 bg-teal-600/10 border border-teal-500/20 rounded-lg">
                <span className="text-xs text-teal-400 truncate flex-1">
                  animetracker.lol/u/{username}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://animetracker.lol/u/${username}`);
                    enqueueSnackbar('Link copied!', { variant: 'success' });
                  }}
                  className="text-xs text-teal-300 hover:text-teal-200 font-medium shrink-0"
                >
                  Copy
                </button>
              </div>
            )}

            <button
              onClick={saveProfile}
              disabled={savingProfile || (!username && isPublic)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>

            {!username && isPublic && (
              <p className="text-xs text-yellow-400">Set a username to make your profile public</p>
            )}
          </div>
        </div>

        <DatabaseSeed />
      </div>
    </div>
  );
}
