'use client';

import { useEffect, useState, useCallback } from 'react';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID, WATCHED_EPISODES_COLLECTION_ID } from '@/lib/appwrite';
import AnimeCard from '@/components/AnimeCard';
import EpisodeGrid from '@/components/EpisodeGrid';
import AddToPlaylist from '@/components/AddToPlaylist';
import Image from 'next/image';
import type { WatchStatus } from '@/lib/types';

function upgradeImageUrl(url: string): string {
  return url.replace('/medium/', '/large/');
}

interface WatchlistDoc {
  $id: string;
  user_id: string;
  media_id: number;
  title_romaji: string;
  title_english: string;
  cover_url: string;
  status: string;
  total_episodes: number | null;
  next_airing_episode: number | null;
  watch_status?: WatchStatus;
}

interface WatchedDoc {
  $id: string;
  user_id: string;
  media_id: number;
  episode_number: number;
}

const WATCH_STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];
const ALL_FILTER = 'All';

const statusColors: Record<WatchStatus, string> = {
  Watching: 'bg-emerald-900/60 text-emerald-300',
  Planned: 'bg-blue-900/60 text-blue-300',
  Completed: 'bg-purple-900/60 text-purple-300',
  Dropped: 'bg-red-900/60 text-red-300',
};

type ViewMode = 'list' | 'card';

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistDoc[]>([]);
  const [watchedMap, setWatchedMap] = useState<Record<number, WatchedDoc[]>>({});
  const [selectedEntry, setSelectedEntry] = useState<WatchlistDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WatchStatus | typeof ALL_FILTER>(ALL_FILTER);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('watchlist_view') as ViewMode) || 'list';
    }
    return 'list';
  });

  const loadWatchlist = useCallback(async () => {
    try {
      const user = await account.get();

      const watchlist = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.orderDesc('$createdAt'),
      ]);

      const watched = await databases.listDocuments(DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.limit(5000),
      ]);

      const docs = watchlist.documents as unknown as WatchlistDoc[];
      setEntries(docs);

      if (selectedEntry) {
        const updated = docs.find((d) => d.$id === selectedEntry.$id);
        if (updated) setSelectedEntry(updated);
      }

      const map: Record<number, WatchedDoc[]> = {};
      (watched.documents as unknown as WatchedDoc[]).forEach((w) => {
        if (!map[w.media_id]) map[w.media_id] = [];
        map[w.media_id].push(w);
      });
      setWatchedMap(map);
    } catch {
      // Not authenticated — layout will redirect
    }
    setLoading(false);
  }, [selectedEntry]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  async function removeFromWatchlist(entry: WatchlistDoc) {
    await databases.deleteDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, entry.$id);

    const episodeDocs = watchedMap[entry.media_id] || [];
    for (const doc of episodeDocs) {
      await databases.deleteDocument(DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, doc.$id);
    }

    setSelectedEntry(null);
    loadWatchlist();
  }

  async function updateWatchStatus(entry: WatchlistDoc, newStatus: WatchStatus) {
    await databases.updateDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, entry.$id, {
      watch_status: newStatus,
    });
    loadWatchlist();
  }

  async function toggleEpisode(mediaId: number, episode: number) {
    const user = await account.get();
    const episodeDocs = watchedMap[mediaId] || [];
    const existing = episodeDocs.find((d) => d.episode_number === episode);

    if (existing) {
      await databases.deleteDocument(DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, existing.$id);
    } else {
      await databases.createDocument(DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, ID.unique(), {
        user_id: user.$id,
        media_id: mediaId,
        episode_number: episode,
      });
    }
    loadWatchlist();
  }

  function getAvailableEpisodes(entry: WatchlistDoc): number | undefined {
    if (entry.status === 'RELEASING' && entry.next_airing_episode) {
      return entry.next_airing_episode - 1;
    }
    return undefined;
  }

  if (loading) {
    return <p className="text-gray-500 text-center mt-12">Loading watchlist...</p>;
  }

  if (selectedEntry) {
    const episodeDocs = watchedMap[selectedEntry.media_id] || [];
    const watchedEpisodes = episodeDocs.map((d) => d.episode_number);
    const total = selectedEntry.total_episodes || Math.max(watchedEpisodes.length, 12);
    const title = selectedEntry.title_english || selectedEntry.title_romaji || 'Unknown';
    const watchStatus = selectedEntry.watch_status || 'Watching';
    const availableUpTo = getAvailableEpisodes(selectedEntry);

    return (
      <div>
        <button onClick={() => setSelectedEntry(null)} className="text-teal-400 text-sm mb-4 hover:text-teal-300">
          &larr; Back to watchlist
        </button>
        <div className="flex gap-4 items-center mb-6">
          <img src={upgradeImageUrl(selectedEntry.cover_url)} alt="" className="w-16 h-24 rounded object-cover" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
            <p className="text-sm text-gray-500">{watchedEpisodes.length}/{selectedEntry.total_episodes || '?'} watched</p>
            <select
              value={watchStatus}
              onChange={(e) => updateWatchStatus(selectedEntry, e.target.value as WatchStatus)}
              className="mt-2 px-3 py-1 text-sm bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 outline-none"
            >
              {WATCH_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <AddToPlaylist mediaId={selectedEntry.media_id} />
            <button
              onClick={() => removeFromWatchlist(selectedEntry)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
            >
              Remove
            </button>
          </div>
        </div>

        {availableUpTo !== undefined && availableUpTo < total && (
          <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-block w-4 h-4 rounded border border-dashed border-[#253040] bg-[#111827]" />
            <span>Dashed episodes have not aired yet</span>
          </div>
        )}

        <EpisodeGrid
          totalEpisodes={total}
          watchedEpisodes={watchedEpisodes}
          onToggle={(ep) => toggleEpisode(selectedEntry.media_id, ep)}
          availableUpTo={availableUpTo}
        />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-500 mt-12">
        <p>No anime tracked yet.</p>
        <p className="mt-1">Use the <strong>Search</strong> tab to find and add anime.</p>
      </div>
    );
  }

  const filteredEntries = filter === ALL_FILTER
    ? entries
    : entries.filter((e) => (e.watch_status || 'Watching') === filter);

  const counts: Record<string, number> = {
    [ALL_FILTER]: entries.length,
    ...Object.fromEntries(WATCH_STATUSES.map((s) => [s, entries.filter((e) => (e.watch_status || 'Watching') === s).length])),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-200">Watchlist</h1>
        <div className="flex gap-1 bg-[#141925] rounded-lg p-0.5 border border-[#253040]">
          <button
            onClick={() => { setViewMode('list'); localStorage.setItem('watchlist_view', 'list'); }}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-teal-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="List view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button
            onClick={() => { setViewMode('card'); localStorage.setItem('watchlist_view', 'card'); }}
            className={`p-1.5 rounded transition-colors ${viewMode === 'card' ? 'bg-teal-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Card view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[ALL_FILTER, ...WATCH_STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s as WatchStatus | typeof ALL_FILTER)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-teal-600 text-white'
                : 'bg-[#141925] text-gray-400 hover:text-gray-200'
            }`}
          >
            {s} <span className="text-xs opacity-60">({counts[s] || 0})</span>
          </button>
        ))}
      </div>

      {filteredEntries.length === 0 ? (
        <p className="text-gray-500 text-center mt-8">No anime with status &ldquo;{filter}&rdquo;</p>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {filteredEntries.map((entry) => {
            const episodeDocs = watchedMap[entry.media_id] || [];
            const title = entry.title_english || entry.title_romaji || 'Unknown';
            const watchStatus = entry.watch_status || 'Watching';
            return (
              <AnimeCard
                key={entry.$id}
                title={title}
                coverUrl={upgradeImageUrl(entry.cover_url)}
                status={entry.status}
                episodes={entry.total_episodes}
                progress={`${episodeDocs.length}/${entry.total_episodes || '?'} watched`}
                onClick={() => setSelectedEntry(entry)}
                action={
                  <div className="flex items-center gap-1">
                    <AddToPlaylist mediaId={entry.media_id} />
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${statusColors[watchStatus]}`}>
                      {watchStatus}
                    </span>
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredEntries.map((entry) => {
            const episodeDocs = watchedMap[entry.media_id] || [];
            const title = entry.title_english || entry.title_romaji || 'Unknown';
            const watchStatus = entry.watch_status || 'Watching';
            return (
              <div
                key={entry.$id}
                className="bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors group"
                onClick={() => setSelectedEntry(entry)}
              >
                <div className="relative w-full aspect-[3/4]">
                  <Image
                    src={upgradeImageUrl(entry.cover_url) || '/icon-128.png'}
                    alt={title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute top-1.5 right-1.5 flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <AddToPlaylist mediaId={entry.media_id} />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${statusColors[watchStatus]}`}>
                      {watchStatus}
                    </span>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-200 truncate" title={title}>{title}</p>
                  <p className="text-[10px] text-teal-400 mt-0.5">
                    {episodeDocs.length}/{entry.total_episodes || '?'} watched
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
