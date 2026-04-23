'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID } from '@/lib/appwrite';
import { searchAnime, fetchRecommendations, mediaToWatchlistEntry } from '@/lib/anilist';
import SearchBar from '@/components/SearchBar';
import AnimeCard from '@/components/AnimeCard';
import AddToPlaylist from '@/components/AddToPlaylist';
import Image from 'next/image';
import { useSfw } from '@/lib/sfw-context';
import type { AniListMedia } from '@/lib/types';

function RecommendationGrid({
  title,
  items,
  onClickAnime,
}: {
  title: string;
  items: AniListMedia[];
  onClickAnime: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {items.map((media) => {
          const mediaTitle = media.title.english || media.title.romaji;
          return (
            <div
              key={media.id}
              className={`bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors group ${media.isAdult ? 'border border-red-500/40' : ''}`}
              onClick={() => onClickAnime(media.id)}
            >
              <div className="relative w-full aspect-[3/4]">
                <Image
                  src={media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '/icon-128.png'}
                  alt={mediaTitle}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <AddToPlaylist mediaId={media.id} />
                </div>
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-gray-200 truncate" title={mediaTitle}>
                  {mediaTitle}
                </p>
                {media.episodes && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{media.episodes} eps</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const { sfwMode } = useSfw();
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [trending, setTrending] = useState<AniListMedia[]>([]);
  const [popular, setPopular] = useState<AniListMedia[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);

  useEffect(() => {
    async function loadRecs() {
      try {
        const recs = await fetchRecommendations();
        setTrending(recs.trending);
        setPopular(recs.popular);
      } catch {
        // Non-critical
      }
      setRecsLoading(false);
    }
    loadRecs();
  }, []);

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

  const showRecommendations = !searched && !loading;

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

      {!loading && searched && results.length > 0 && (
        <div className="space-y-2">
          {results.filter((m) => !sfwMode || !m.isAdult).map((media) => {
            const inList = addedIds.has(media.id);
            const title = media.title.english || media.title.romaji;
            return (
              <AnimeCard
                key={media.id}
                title={title}
                coverUrl={media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || ''}
                status={media.status}
                episodes={media.episodes}
                isAdult={media.isAdult}
                onClick={() => router.push(`/anime/${media.id}`)}
                action={
                  <div className="flex items-center gap-1">
                    <div className="opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <AddToPlaylist mediaId={media.id} />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); addToWatchlist(media); }}
                      disabled={inList}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium disabled:opacity-50"
                    >
                      {inList ? 'Added' : '+ Add'}
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {showRecommendations && (
        recsLoading ? (
          <div className="flex justify-center mt-8">
            <div className="w-6 h-6 border-2 border-[#253040] border-t-teal-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <RecommendationGrid
              title="Trending Now"
              items={sfwMode ? trending.filter((m) => !m.isAdult) : trending}
              onClickAnime={(id) => router.push(`/anime/${id}`)}
            />
            <RecommendationGrid
              title="Popular This Season"
              items={sfwMode ? popular.filter((m) => !m.isAdult) : popular}
              onClickAnime={(id) => router.push(`/anime/${id}`)}
            />
          </>
        )
      )}
    </div>
  );
}
