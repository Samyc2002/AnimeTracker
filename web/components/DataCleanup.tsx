'use client';

import { useState } from 'react';
import { Query } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID } from '@/lib/appwrite';
import { searchAnime, fetchAnimeDetail } from '@/lib/anime-provider';
import { enqueueSnackbar } from 'notistack';

interface WatchlistDoc {
  $id: string;
  media_id: number;
  id_mal: number | null;
  title_romaji: string | null;
  title_english: string | null;
  cover_url: string;
  status: string;
  total_episodes: number | null;
  next_airing_episode: number | null;
  next_airing_at: number | null;
  watch_status: string;
  is_adult: boolean;
}

interface CleanupResult {
  duplicatesRemoved: number;
  malIdsBackfilled: number;
  metadataRefreshed: number;
  errors: number;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DataCleanup() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<CleanupResult | null>(null);

  async function runCleanup() {
    setRunning(true);
    setResult(null);
    const stats: CleanupResult = { duplicatesRemoved: 0, malIdsBackfilled: 0, metadataRefreshed: 0, errors: 0 };

    try {
      const user = await account.get();
      setProgress('Fetching watchlist...');

      const res = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.limit(500),
      ]);
      const entries = res.documents as unknown as (WatchlistDoc & { $id: string })[];

      // Step 1: Deduplicate
      setProgress(`Step 1/3: Checking for duplicates among ${entries.length} entries...`);
      const titleGroups = new Map<string, (WatchlistDoc & { $id: string })[]>();
      for (const entry of entries) {
        const key = (entry.title_romaji || '').toLowerCase().trim();
        if (!key) continue;
        if (!titleGroups.has(key)) titleGroups.set(key, []);
        titleGroups.get(key)!.push(entry);
      }

      for (const [, group] of titleGroups) {
        if (group.length <= 1) continue;
        group.sort((a, b) => {
          if (a.id_mal && !b.id_mal) return -1;
          if (!a.id_mal && b.id_mal) return 1;
          return 0;
        });
        const keep = group[0];
        for (let i = 1; i < group.length; i++) {
          try {
            await databases.deleteDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, group[i].$id);
            stats.duplicatesRemoved++;
          } catch {
            stats.errors++;
          }
        }
        // Keep the best watch_status from duplicates
        const statuses = group.map(g => g.watch_status);
        if (statuses.includes('Watching') && keep.watch_status !== 'Watching') {
          try {
            await databases.updateDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, keep.$id, {
              watch_status: 'Watching',
            });
          } catch { /* non-critical */ }
        }
      }

      // Refresh entries list after dedup
      const refreshedRes = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.limit(500),
      ]);
      const cleanEntries = refreshedRes.documents as unknown as (WatchlistDoc & { $id: string })[];

      // Step 2: Backfill missing MAL IDs
      const needsMalId = cleanEntries.filter(e => !e.id_mal);
      setProgress(`Step 2/3: Backfilling MAL IDs for ${needsMalId.length} entries...`);

      for (let i = 0; i < needsMalId.length; i++) {
        const entry = needsMalId[i];
        setProgress(`Step 2/3: Backfilling MAL IDs (${i + 1}/${needsMalId.length})...`);
        try {
          const title = entry.title_romaji || entry.title_english || '';
          if (!title) continue;
          const results = await searchAnime(title);
          const match = results.find(r =>
            r.idMal && (r.title.romaji?.toLowerCase() === title.toLowerCase() || r.title.english?.toLowerCase() === title.toLowerCase())
          ) || results[0];
          if (match?.idMal) {
            await databases.updateDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, entry.$id, {
              id_mal: match.idMal,
            });
            stats.malIdsBackfilled++;
          }
          await delay(1000);
        } catch {
          stats.errors++;
        }
      }

      // Step 3: Refresh stale metadata
      setProgress(`Step 3/3: Refreshing metadata for ${cleanEntries.length} entries...`);

      for (let i = 0; i < cleanEntries.length; i++) {
        const entry = cleanEntries[i];
        setProgress(`Step 3/3: Refreshing metadata (${i + 1}/${cleanEntries.length})...`);
        try {
          const detail = await fetchAnimeDetail(entry.media_id);
          const updates: Record<string, unknown> = {};
          if (detail.status && detail.status !== entry.status) updates.status = detail.status;
          if (detail.episodes !== undefined && detail.episodes !== entry.total_episodes) updates.total_episodes = detail.episodes;
          const nextEp = detail.nextAiringEpisode?.episode ?? null;
          const nextAt = detail.nextAiringEpisode?.airingAt ?? null;
          if (nextEp !== entry.next_airing_episode) updates.next_airing_episode = nextEp;
          if (nextAt !== entry.next_airing_at) updates.next_airing_at = nextAt;
          const coverUrl = detail.coverImage.extraLarge || detail.coverImage.large || detail.coverImage.medium || '';
          if (coverUrl && coverUrl !== entry.cover_url) updates.cover_url = coverUrl;
          if (detail.isAdult !== undefined && detail.isAdult !== entry.is_adult) updates.is_adult = detail.isAdult;

          if (Object.keys(updates).length > 0) {
            await databases.updateDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, entry.$id, updates);
            stats.metadataRefreshed++;
          }
          await delay(500);
        } catch {
          stats.errors++;
        }
      }

      setResult(stats);
      setProgress('');
      enqueueSnackbar('Data cleanup complete!', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(`Cleanup failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { variant: 'error' });
    }
    setRunning(false);
  }

  return (
    <div className="border-t border-[#253040] pt-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Data Cleanup</h2>
      <p className="text-xs text-gray-600 mb-3">
        Removes duplicate entries, backfills missing MAL IDs, and refreshes stale metadata (status, episodes, images).
        Your watch statuses and watchlist choices are preserved.
      </p>

      {result && (
        <div className="mb-3 px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-xs text-gray-400 space-y-1">
          <p>Duplicates removed: <span className="text-teal-400">{result.duplicatesRemoved}</span></p>
          <p>MAL IDs backfilled: <span className="text-teal-400">{result.malIdsBackfilled}</span></p>
          <p>Metadata refreshed: <span className="text-teal-400">{result.metadataRefreshed}</span></p>
          {result.errors > 0 && <p>Errors: <span className="text-red-400">{result.errors}</span></p>}
        </div>
      )}

      {progress && (
        <p className="text-xs text-gray-500 mb-3">{progress}</p>
      )}

      <button
        onClick={runCleanup}
        disabled={running}
        className="px-4 py-2 bg-[#141925] hover:bg-[#1c2333] text-gray-300 text-sm rounded-lg border border-[#253040] transition-colors disabled:opacity-50"
      >
        {running ? 'Running...' : 'Run Data Cleanup'}
      </button>
    </div>
  );
}
