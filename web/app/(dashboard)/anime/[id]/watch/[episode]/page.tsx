'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID, WATCHED_EPISODES_COLLECTION_ID } from '@/lib/appwrite';
import { fetchAnimeDetail } from '@/lib/anilist';
import { getEpisodeStream } from '@/lib/stream-provider';
import type { StreamSource } from '@/lib/stream-provider';
import type { AnimeDetail } from '@/lib/types';
import VideoPlayer from '@/components/VideoPlayer';
import EpisodeGrid from '@/components/EpisodeGrid';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const animeId = Number(params.id);
  const episodeNum = Number(params.episode);

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState<number[]>([]);
  const [isWatched, setIsWatched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSources, setLoadingSources] = useState(true);
  const [toggling, setToggling] = useState(false);

  const totalEpisodes = anime?.episodes || anime?.nextAiringEpisode?.episode
    ? (anime?.nextAiringEpisode?.episode ?? 0) - 1
    : 0;
  const effectiveTotal = anime?.episodes || totalEpisodes || episodeNum;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const detail = await fetchAnimeDetail(animeId);
        setAnime(detail);
      } catch {
        setAnime(null);
      }
      setLoading(false);
    }
    load();
  }, [animeId]);

  useEffect(() => {
    async function loadWatched() {
      try {
        const user = await account.get();
        const res = await databases.listDocuments(DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, [
          Query.equal('user_id', user.$id),
          Query.equal('media_id', animeId),
          Query.limit(5000),
        ]);
        const eps = res.documents.map((d) => (d as unknown as { episode_number: number }).episode_number);
        setWatchedEpisodes(eps);
        setIsWatched(eps.includes(episodeNum));
      } catch {
        // Not logged in
      }
    }
    loadWatched();
  }, [animeId, episodeNum]);

  useEffect(() => {
    async function loadSources() {
      setLoadingSources(true);
      try {
        const result = await getEpisodeStream(anime?.idMal ?? null, animeId, episodeNum);
        setSources(result);
      } catch {
        setSources([]);
      }
      setLoadingSources(false);
    }
    if (anime) {
      loadSources();
    }
  }, [anime, animeId, episodeNum]);

  async function toggleWatched() {
    if (toggling) return;
    setToggling(true);
    try {
      const user = await account.get();

      if (isWatched) {
        const res = await databases.listDocuments(DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, [
          Query.equal('user_id', user.$id),
          Query.equal('media_id', animeId),
          Query.limit(5000),
        ]);
        const doc = res.documents.find(
          (d) => (d as unknown as { episode_number: number }).episode_number === episodeNum
        );
        if (doc) {
          await databases.deleteDocument(DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, doc.$id);
        }
        setIsWatched(false);
        setWatchedEpisodes((prev) => prev.filter((e) => e !== episodeNum));
      } else {
        // Check if anime is in watchlist first, add if not
        const wlRes = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
          Query.equal('user_id', user.$id),
          Query.equal('media_id', animeId),
          Query.limit(1),
        ]);
        if (wlRes.documents.length === 0 && anime) {
          const { mediaToWatchlistEntry } = await import('@/lib/anilist');
          const entry = mediaToWatchlistEntry({
            id: anime.id,
            idMal: anime.idMal,
            title: { romaji: anime.title.romaji, english: anime.title.english },
            coverImage: anime.coverImage,
            status: anime.status,
            episodes: anime.episodes,
            nextAiringEpisode: anime.nextAiringEpisode,
          });
          await databases.createDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, ID.unique(), {
            ...entry,
            user_id: user.$id,
          });
        }

        await databases.createDocument(DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, ID.unique(), {
          user_id: user.$id,
          media_id: animeId,
          episode_number: episodeNum,
        });
        setIsWatched(true);
        setWatchedEpisodes((prev) => [...prev, episodeNum].sort((a, b) => a - b));
      }
    } catch {
      // Error toggling
    }
    setToggling(false);
  }

  function handleVideoEnded() {
    if (!isWatched) {
      toggleWatched();
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center mt-12">
        <div className="w-6 h-6 border-2 border-[#3a3a5c] border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!anime) {
    return <p className="text-gray-500 text-center mt-12">Anime not found.</p>;
  }

  const title = anime.title.english || anime.title.romaji;
  const hasPrev = episodeNum > 1;
  const hasNext = episodeNum < effectiveTotal;

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/anime/${animeId}`}
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          &larr; Back to {title}
        </Link>
      </div>

      {loadingSources ? (
        <div className="w-full aspect-video bg-[#0a0a1a] rounded-lg flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#3a3a5c] border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <VideoPlayer sources={sources} onEnded={handleVideoEnded} />
      )}

      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-200">{title}</h1>
          <p className="text-sm text-gray-400">Episode {episodeNum}</p>
        </div>

        <button
          onClick={toggleWatched}
          disabled={toggling}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
            isWatched
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-[#16213e] text-gray-300 hover:bg-[#1e2d4d] border border-[#3a3a5c]'
          } disabled:opacity-50`}
        >
          {toggling ? '...' : isWatched ? 'Watched' : 'Mark as Watched'}
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        {hasPrev ? (
          <button
            onClick={() => router.push(`/anime/${animeId}/watch/${episodeNum - 1}`)}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            &larr; Episode {episodeNum - 1}
          </button>
        ) : (
          <div />
        )}
        {hasNext ? (
          <button
            onClick={() => router.push(`/anime/${animeId}/watch/${episodeNum + 1}`)}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Episode {episodeNum + 1} &rarr;
          </button>
        ) : (
          <div />
        )}
      </div>

      {effectiveTotal > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Episodes</h2>
          <EpisodeGrid
            totalEpisodes={effectiveTotal}
            watchedEpisodes={watchedEpisodes}
            linkPrefix={`/anime/${animeId}/watch`}
            currentEpisode={episodeNum}
          />
        </div>
      )}
    </div>
  );
}
