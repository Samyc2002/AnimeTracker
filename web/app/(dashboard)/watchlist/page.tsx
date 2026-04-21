'use client';

import { useEffect, useState, useCallback } from 'react';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID, WATCHED_EPISODES_COLLECTION_ID } from '@/lib/appwrite';
import AnimeCard from '@/components/AnimeCard';
import EpisodeGrid from '@/components/EpisodeGrid';

interface WatchlistDoc {
  $id: string;
  user_id: string;
  media_id: number;
  title_romaji: string;
  title_english: string;
  cover_url: string;
  status: string;
  total_episodes: number | null;
}

interface WatchedDoc {
  $id: string;
  user_id: string;
  media_id: number;
  episode_number: number;
}

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistDoc[]>([]);
  const [watchedMap, setWatchedMap] = useState<Record<number, WatchedDoc[]>>({});
  const [selectedEntry, setSelectedEntry] = useState<WatchlistDoc | null>(null);
  const [loading, setLoading] = useState(true);

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

      setEntries(watchlist.documents as unknown as WatchlistDoc[]);

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
  }, []);

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

  if (loading) {
    return <p className="text-gray-500 text-center mt-12">Loading watchlist...</p>;
  }

  if (selectedEntry) {
    const episodeDocs = watchedMap[selectedEntry.media_id] || [];
    const watchedEpisodes = episodeDocs.map((d) => d.episode_number);
    const total = selectedEntry.total_episodes || Math.max(watchedEpisodes.length, 12);
    const title = selectedEntry.title_english || selectedEntry.title_romaji || 'Unknown';

    return (
      <div>
        <button onClick={() => setSelectedEntry(null)} className="text-purple-400 text-sm mb-4 hover:text-purple-300">
          &larr; Back to watchlist
        </button>
        <div className="flex gap-4 items-center mb-6">
          <img src={selectedEntry.cover_url} alt="" className="w-16 h-24 rounded object-cover" />
          <div>
            <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
            <p className="text-sm text-gray-500">{watchedEpisodes.length}/{selectedEntry.total_episodes || '?'} watched</p>
          </div>
          <button
            onClick={() => removeFromWatchlist(selectedEntry)}
            className="ml-auto px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
          >
            Remove
          </button>
        </div>
        <EpisodeGrid
          totalEpisodes={total}
          watchedEpisodes={watchedEpisodes}
          onToggle={(ep) => toggleEpisode(selectedEntry.media_id, ep)}
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

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-bold text-gray-200 mb-4">Watchlist</h1>
      {entries.map((entry) => {
        const episodeDocs = watchedMap[entry.media_id] || [];
        const title = entry.title_english || entry.title_romaji || 'Unknown';
        return (
          <AnimeCard
            key={entry.$id}
            title={title}
            coverUrl={entry.cover_url}
            status={entry.status}
            episodes={entry.total_episodes}
            progress={`${episodeDocs.length}/${entry.total_episodes || '?'} watched`}
            onClick={() => setSelectedEntry(entry)}
          />
        );
      })}
    </div>
  );
}
