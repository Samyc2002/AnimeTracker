'use client';

import { useState, useCallback } from 'react';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID } from '@/lib/appwrite';
import { searchAnime, mediaToWatchlistEntry } from '@/lib/anilist';
import SearchBar from '@/components/SearchBar';
import AnimeCard from '@/components/AnimeCard';
import type { AniListMedia } from '@/lib/types';

export default function SearchPage() {
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const media = await searchAnime(query);
      setResults(media);

      const user = await account.get();
      const existing = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.select(['media_id']),
        Query.limit(500),
      ]);
      setAddedIds(new Set(existing.documents.map((d) => (d as unknown as { media_id: number }).media_id)));
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  async function addToWatchlist(media: AniListMedia) {
    const user = await account.get();
    const entry = mediaToWatchlistEntry(media);
    await databases.createDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, ID.unique(), {
      ...entry,
      user_id: user.$id,
    });
    setAddedIds((prev) => new Set(prev).add(media.id));
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-200 mb-4">Search Anime</h1>
      <div className="mb-6">
        <SearchBar onSearch={handleSearch} />
      </div>

      {loading && <p className="text-gray-500 text-center">Searching...</p>}

      {!loading && searched && results.length === 0 && (
        <p className="text-gray-500 text-center">No results found.</p>
      )}

      <div className="space-y-2">
        {results.map((media) => {
          const inList = addedIds.has(media.id);
          const title = media.title.english || media.title.romaji;
          return (
            <AnimeCard
              key={media.id}
              title={title}
              coverUrl={media.coverImage?.medium || ''}
              status={media.status}
              episodes={media.episodes}
              action={
                <button
                  onClick={(e) => { e.stopPropagation(); addToWatchlist(media); }}
                  disabled={inList}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium disabled:opacity-50"
                >
                  {inList ? 'Added' : '+ Add'}
                </button>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
