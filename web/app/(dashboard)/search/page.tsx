'use client';

import { useTitle } from '@/lib/useTitle';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { searchAnimePaginated, fetchRecommendations, getErrorMessage } from '@/lib/anime-provider';
import { enqueueSnackbar } from 'notistack';
import SearchBar from '@/components/SearchBar';
import AnimeCard from '@/components/AnimeCard';
import AddToPlaylist from '@/components/AddToPlaylist';
import AddToWatchlist from '@/components/AddToWatchlist';
import Image from 'next/image';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Spinner';
import type { AniListMedia } from '@/lib/types';
import { getRandomQuote } from '@/lib/loading-quotes';

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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
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
                  src={media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '/placeholder.png'}
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
  useTitle('Search');
  const router = useRouter();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const { authed, userId } = useAuth();
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentQuery, setCurrentQuery] = useState('');
  const [loadingQuote, setLoadingQuote] = useState('');
  const [recsQuote] = useState(() => getRandomQuote('recommend'));
  const [trending, setTrending] = useState<AniListMedia[]>([]);
  const [popular, setPopular] = useState<AniListMedia[]>([]);
  const [forYou, setForYou] = useState<AniListMedia[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);

  useEffect(() => {
    async function loadRecs() {
      try {
        const recs = await fetchRecommendations();
        setTrending(recs.trending);
        setPopular(recs.popular);
      } catch (err) {
        enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
      }
      setRecsLoading(false);
    }
    loadRecs();
  }, []);

  useEffect(() => {
    if (!authed || !userId) return;
    async function loadForYou() {
      try {
        const profileRes = await fetch('/api/taste-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const profileData = await profileRes.json();
        if (profileData.insufficient || !profileData.profile) return;

        const topGenres = profileData.profile.topGenres.slice(0, 3).map((g: { genre: string }) => g.genre);
        const recRes = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            filters: { genres: topGenres, status: null, minScore: 70, maxEpisodes: null, sort: 'SCORE_DESC', excludeMediaIds: [] },
          }),
        });
        const recData = await recRes.json();
        setForYou((recData.results || []).slice(0, 10));
      } catch {
        // Silently skip — For You is optional
      }
    }
    loadForYou();
  }, [authed, userId]);

  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    setSearched(true);
    setCurrentQuery(query);
    setCurrentPage(1);
    setLoadingQuote(getRandomQuote('search'));
    const start = Date.now();
    try {
      const { results: media, hasNextPage: more } = await searchAnimePaginated(query, 1);
      setResults(media);
      setHasNextPage(more);
    } catch (err) {
      setResults([]);
      setHasNextPage(false);
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
    const elapsed = Date.now() - start;
    if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
    setLoading(false);
  }, []);

  const handlePageChange = useCallback(async (page: number) => {
    setLoading(true);
    setLoadingQuote(getRandomQuote('search'));
    const start = Date.now();
    try {
      const { results: media, hasNextPage: more } = await searchAnimePaginated(currentQuery, page);
      setResults(media);
      setHasNextPage(more);
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
    const elapsed = Date.now() - start;
    if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
    setLoading(false);
  }, [currentQuery]);

  const showRecommendations = !searched && !loading;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-200 mb-4">Search Anime</h1>
      <div className="mb-6">
        <SearchBar onSearch={handleSearch} />
      </div>

      {loading && (
        <div className="text-center">
          <p className="text-gray-500">Searching...</p>
          <p className="text-base text-gray-400 italic mt-1">{loadingQuote}</p>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-gray-500 text-center">No results found.</p>
      )}

      {!loading && searched && results.length > 0 && (
        <>
          <div className="space-y-2">
            {results.filter((m) => !sfwMode || !m.isAdult).map((media) => {
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
                      <AddToWatchlist media={media} />
                    </div>
                  }
                />
              );
            })}
          </div>
          {(currentPage > 1 || hasNextPage) && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 text-sm bg-[#141925] border border-[#253040] rounded-lg text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              <span className="text-sm text-gray-500">
                Page {currentPage}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasNextPage}
                className="px-3 py-1.5 text-sm bg-[#141925] border border-[#253040] rounded-lg text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {showRecommendations && (
        recsLoading ? (
          <div className="flex flex-col items-center mt-8">
            <Spinner />
            <p className="text-base text-gray-400 italic mt-2">{recsQuote}</p>
          </div>
        ) : (
          <>
            {forYou.length > 0 && (
              <RecommendationGrid
                title="For You"
                items={sfwMode ? forYou.filter((m) => !m.isAdult) : forYou}
                onClickAnime={(id) => router.push(`/anime/${id}`)}
              />
            )}
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
