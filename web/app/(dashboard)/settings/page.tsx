'use client';

import { useTitle } from '@/lib/useTitle';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/lib/auth-context';
import SeriesBackfill from '@/components/SeriesBackfill';
import { AVATAR_OPTIONS } from '@/lib/avatars';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { enqueueSnackbar } from 'notistack';
import { fireClientAchievementEvent } from '@/lib/achievements/fire-event';
import { useProviderHealth } from '@/lib/provider-status';

interface ProfileDoc {
  id: string;
  display_language: string;
  anilist_user_id?: number;
  username?: string;
  display_name?: string;
  is_public?: boolean;
  hide_nsfw_public?: boolean;
  avatar?: string;
  social_twitter?: string;
  social_discord?: string;
  social_instagram?: string;
  social_reddit?: string;
  kitsu_username?: string;
}

export default function SettingsPageGuarded() {
  return <RequireAuth><SettingsPage /></RequireAuth>;
}

function SettingsPage() {
  useTitle('Settings');
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const { userId, userEmail } = useAuth();
  const providerHealth = useProviderHealth();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState('English');
  const [saving, setSaving] = useState(false);
  const [profileDocId, setProfileDocId] = useState<string | null>(null);
  const [anilistConnected, setAnilistConnected] = useState(false);
  const [anilistUserId, setAnilistUserId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [hideNsfwPublic, setHideNsfwPublic] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [socialTwitter, setSocialTwitter] = useState('');
  const [socialDiscord, setSocialDiscord] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialReddit, setSocialReddit] = useState('');
  const [kitsuUsername, setKitsuUsername] = useState('');
  const [kitsuConnected, setKitsuConnected] = useState(false);
  const [kitsuImporting, setKitsuImporting] = useState(false);
  const [kitsuImportResult, setKitsuImportResult] = useState<string | null>(null);


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
      if (!userId) return;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_language, anilist_user_id, username, display_name, is_public, hide_nsfw_public, avatar, social_twitter, social_discord, social_instagram, social_reddit, kitsu_username')
        .eq('user_id', userId)
        .limit(1);

      if (profiles && profiles.length > 0) {
        const profile = profiles[0] as ProfileDoc;
        setLanguage(profile.display_language);
        setProfileDocId(profile.id);
        if (profile.username) setUsername(profile.username);
        if (profile.display_name) setDisplayName(profile.display_name);
        if (profile.is_public) setIsPublic(profile.is_public);
        if (profile.hide_nsfw_public) setHideNsfwPublic(profile.hide_nsfw_public);
        if (profile.avatar) setAvatar(profile.avatar);
        if (profile.social_twitter) setSocialTwitter(profile.social_twitter);
        if (profile.social_discord) setSocialDiscord(profile.social_discord);
        if (profile.social_instagram) setSocialInstagram(profile.social_instagram);
        if (profile.social_reddit) setSocialReddit(profile.social_reddit);
        if (profile.kitsu_username) {
          setKitsuUsername(profile.kitsu_username);
          setKitsuConnected(true);
        }
        if (profile.anilist_user_id) {
          setAnilistConnected(true);
          setAnilistUserId(profile.anilist_user_id);
        }
      } else {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({ user_id: userId, display_language: 'English' })
          .select()
          .single();
        if (newProfile) setProfileDocId(newProfile.id);
      }
    }
    load();
  }, [userId]);

  async function saveLanguage(value: string) {
    setLanguage(value);
    if (!profileDocId) return;
    setSaving(true);
    await supabase.from('profiles').update({ display_language: value }).eq('id', profileDocId);
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
    await supabase.from('profiles').update({
      anilist_user_id: null,
      anilist_token: null,
    }).eq('id', profileDocId);
    setAnilistConnected(false);
    setAnilistUserId(null);
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
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .limit(1);
        if (existing && existing.length > 0 && existing[0].id !== profileDocId) {
          setUsernameError('Username is already taken');
          setSavingProfile(false);
          return;
        }
      }

      await supabase.from('profiles').update({
        username: username || null,
        display_name: displayName || null,
        is_public: isPublic,
        hide_nsfw_public: hideNsfwPublic,
        avatar: avatar || null,
        social_twitter: socialTwitter || null,
        social_discord: socialDiscord || null,
        social_instagram: socialInstagram || null,
        social_reddit: socialReddit || null,
      }).eq('id', profileDocId);
      enqueueSnackbar('Profile saved!', { variant: 'success' });
      if (userId) fireClientAchievementEvent(userId, 'profile_update');
    } catch (err) {
      enqueueSnackbar(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`, { variant: 'error' });
    }
    setSavingProfile(false);
  }

  async function importWatchlist() {
    if (!anilistConnected || !userId) return;
    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch('/api/import-watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportResult(`Import failed: ${data.error}`);
      } else {
        setImportResult(`Imported ${data.created} new, updated ${data.updated} existing anime.`);
        enqueueSnackbar(`Imported ${data.created} new, updated ${data.updated} existing anime`, { variant: 'success' });
      }
    } catch (err) {
      setImportResult(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setImporting(false);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-200 mb-6">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
      <div className="space-y-8">
        <div>
          <p className="text-sm text-gray-400 mb-1">Signed in as</p>
          <p className="text-gray-200">{userEmail}</p>
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
                  Connected as AniList user <span className={`${theme.btnText} font-medium`}>#{anilistUserId}</span>
                </span>
              </div>

              {providerHealth.checked && !providerHealth.anilist && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
                  AniList is currently down. Import is temporarily unavailable.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={importWatchlist}
                  disabled={importing || (providerHealth.checked && !providerHealth.anilist)}
                  className={`px-4 py-2 ${theme.btn} text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors`}
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
                className={`px-4 py-2 ${theme.btn} text-white text-sm rounded-lg font-medium transition-colors`}
              >
                Connect AniList
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-[#253040] pt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Kitsu Integration</h2>

          {kitsuConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-sm text-gray-300">
                  Connected as Kitsu user <span className={`${theme.btnText} font-medium`}>{kitsuUsername}</span>
                </span>
              </div>

              {providerHealth.checked && !providerHealth.kitsu && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
                  Kitsu is currently down. Import is temporarily unavailable.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!userId) return;
                    setKitsuImporting(true);
                    setKitsuImportResult('Fetching your Kitsu library...');
                    try {
                      const controller = new AbortController();
                      const timeout = setTimeout(() => controller.abort(), 55000);
                      const res = await fetch('/api/import-kitsu', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId }),
                        signal: controller.signal,
                      });
                      clearTimeout(timeout);
                      const data = await res.json();
                      if (!res.ok) {
                        const msg = data.possiblePrivate
                          ? `${data.error} If this user's library is private on Kitsu, make it public first at kitsu.app/settings/privacy.`
                          : `Import failed: ${data.error}`;
                        setKitsuImportResult(msg);
                      } else {
                        setKitsuImportResult(`Imported ${data.created} new, updated ${data.updated} existing (${data.total} total from Kitsu).`);
                        enqueueSnackbar(`Imported ${data.created} new, updated ${data.updated} existing anime`, { variant: 'success' });
                      }
                    } catch (err) {
                      if (err instanceof DOMException && err.name === 'AbortError') {
                        setKitsuImportResult('Import is still processing on the server. Your anime should appear in your watchlist shortly. Refresh the page in a minute to check.');
                      } else {
                        setKitsuImportResult(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                      }
                    }
                    setKitsuImporting(false);
                  }}
                  disabled={kitsuImporting || (providerHealth.checked && !providerHealth.kitsu)}
                  className={`px-4 py-2 ${theme.btn} text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors`}
                >
                  {kitsuImporting ? 'Importing...' : 'Import Watchlist'}
                </button>
                <button
                  onClick={async () => {
                    if (!profileDocId) return;
                    await supabase.from('profiles').update({ kitsu_username: null }).eq('id', profileDocId);
                    setKitsuConnected(false);
                    setKitsuUsername('');
                    enqueueSnackbar('Kitsu disconnected', { variant: 'success' });
                  }}
                  className="px-4 py-2 bg-[#141925] hover:bg-[#1c2333] text-gray-300 text-sm rounded-lg border border-[#253040] transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {kitsuImportResult && (
                <p className="text-xs text-gray-400">{kitsuImportResult}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Enter your Kitsu username to import your anime watchlist. No login needed.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={kitsuUsername}
                  onChange={(e) => setKitsuUsername(e.target.value.trim())}
                  placeholder="Your Kitsu username"
                  className="flex-1 px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
                />
                <button
                  onClick={async () => {
                    if (!kitsuUsername || !profileDocId) return;
                    await supabase.from('profiles').update({ kitsu_username: kitsuUsername }).eq('id', profileDocId);
                    setKitsuConnected(true);
                    enqueueSnackbar('Kitsu connected!', { variant: 'success' });
                  }}
                  disabled={!kitsuUsername}
                  className={`px-4 py-2 ${theme.btn} text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors`}
                >
                  Connect
                </button>
              </div>
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
                className={`w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm placeholder:text-gray-600 focus:border-${theme.accent}-500/50 focus:outline-none`}
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
                className={`w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm placeholder:text-gray-600 focus:border-${theme.accent}-500/50 focus:outline-none`}
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
                  isPublic ? theme.activeTab : 'bg-[#253040]'
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
                  hideNsfwPublic ? theme.activeTab : 'bg-[#253040]'
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
              <div className={`flex items-center gap-2 px-3 py-2 ${theme.btnBg} border ${theme.btnBorder} rounded-lg`}>
                <span className={`text-xs ${theme.btnText} truncate flex-1`}>
                  animetracker.lol/u/{username}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://www.animetracker.lol/u/${username}`);
                    enqueueSnackbar('Link copied!', { variant: 'success' });
                  }}
                  className={`text-xs ${theme.link} font-medium shrink-0`}
                >
                  Copy
                </button>
              </div>
            )}

            <button
              onClick={saveProfile}
              disabled={savingProfile || (!username && isPublic)}
              className={`px-4 py-2 ${theme.btn} text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors`}
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>

            {!username && isPublic && (
              <p className="text-xs text-yellow-400">Set a username to make your profile public</p>
            )}
          </div>
        </div>

        <SeriesBackfill />
      </div>

      <div className="space-y-8">
        <div className="border-t lg:border-t-0 border-[#253040] pt-6 lg:pt-0">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Profile Picture</h2>

          <div className="flex justify-center mb-4">
            {avatar ? (
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#253040]">
                <Image src={avatar} alt="Avatar" fill className="object-cover" unoptimized />
              </div>
            ) : (
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${theme.gradientBold} flex items-center justify-center text-3xl font-bold text-white`}>
                {(displayName || username || userEmail || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            <button
              onClick={() => setAvatar(null)}
              className={`aspect-square rounded-full border-2 flex items-center justify-center transition-colors ${
                !avatar ? `border-${theme.accent}-500` : 'border-[#253040] hover:border-gray-500'
              }`}
            >
              <div className={`w-full h-full rounded-full bg-gradient-to-br ${theme.gradientBold} flex items-center justify-center text-sm font-bold text-white`}>
                {(displayName || username || userEmail || '?').charAt(0).toUpperCase()}
              </div>
            </button>
            {AVATAR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setAvatar(opt.src)}
                className={`aspect-square rounded-full border-2 overflow-hidden transition-colors ${
                  avatar === opt.src ? `border-${theme.accent}-500` : 'border-[#253040] hover:border-gray-500'
                }`}
              >
                <Image src={opt.src} alt="" width={60} height={60} className="w-full h-full object-cover" unoptimized />
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[#253040] pt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Social Links</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Twitter / X
              </label>
              <input
                type="text"
                value={socialTwitter}
                onChange={(e) => setSocialTwitter(e.target.value.replace(/^@/, ''))}
                placeholder="@username"
                maxLength={64}
                className="w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                Discord
              </label>
              <input
                type="text"
                value={socialDiscord}
                onChange={(e) => setSocialDiscord(e.target.value)}
                placeholder="username"
                maxLength={64}
                className="w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                Instagram
              </label>
              <input
                type="text"
                value={socialInstagram}
                onChange={(e) => setSocialInstagram(e.target.value.replace(/^@/, ''))}
                placeholder="@username"
                maxLength={64}
                className="w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 flex items-center gap-2 mb-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
                Reddit
              </label>
              <input
                type="text"
                value={socialReddit}
                onChange={(e) => setSocialReddit(e.target.value.replace(/^u\//, ''))}
                placeholder="username"
                maxLength={64}
                className="w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">Saved when you click &quot;Save Profile&quot; on the left.</p>
        </div>
      </div>
      </div>
    </div>
  );
}
