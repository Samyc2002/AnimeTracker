'use client';

import { useTitle } from '@/lib/useTitle';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { fetchRecommendations, getErrorMessage } from '@/lib/anime-provider';
import { searchWithFilters, getAdapterCapabilities } from '@/lib/search/orchestrator';
import {
  type SearchFilterState,
  type ProviderName,
  type ProviderCapabilities,
  DEFAULT_FILTER_STATE,
  isDefaultFilters,
  filtersChanged,
} from '@/lib/search/types';
import { enqueueSnackbar } from 'notistack';
import Link from 'next/link';
import SearchBar, { type SearchBarHandle } from '@/components/SearchBar';
import AnimeCard from '@/components/AnimeCard';
import AddToPlaylist from '@/components/AddToPlaylist';
import AddToWatchlist from '@/components/AddToWatchlist';
import HeaderStrip from '@/components/search/HeaderStrip';
import FilterPanel from '@/components/search/FilterPanel';
import Image from 'next/image';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui/Spinner';
import type { AniListMedia } from '@/lib/types';
import { getRandomQuote } from '@/lib/loading-quotes';

function RecommendationGrid({
  title,
  items,
}: {
  title: string;
  items: AniListMedia[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        {items.map((media, idx) => {
          const mediaTitle = media.title.english || media.title.romaji;
          return (
            <Link
              key={`${media.id}-${idx}`}
              href={`/anime/${media.id}`}
              className={`bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors group ${media.isAdult ? 'border border-red-500/40' : ''}`}
            >
              <div className="relative w-full aspect-[3/4]">
                <Image
                  src={media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '/placeholder.png'}
                  alt={mediaTitle}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}>
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function countActiveFilters(state: SearchFilterState): number {
  let count = 0;
  if (state.format.length > 0) count++;
  if (state.status.length > 0) count++;
  if (state.yearMin !== null || state.yearMax !== null) count++;
  if (state.isAdult !== false) count++;
  if (state.genres.length > 0) count++;
  if (state.excludedGenres.length > 0) count++;
  if (state.scoreMin !== null || state.scoreMax !== null) count++;
  if (state.tags.length > 0) count++;
  if (state.excludedTags.length > 0) count++;
  if (state.minTagRank !== 60) count++;
  if (state.season !== null && state.seasonYear !== null) count++;
  if (state.episodesMin !== null || state.episodesMax !== null) count++;
  if (state.durationMin !== null || state.durationMax !== null) count++;
  if (state.source.length > 0) count++;
  if (state.countryOfOrigin !== null) count++;
  if (state.studios.length > 0) count++;
  if (state.sort !== null) count++;
  if (state.excludeWatchlistStatuses.length > 0) count++;
  return count;
}

export default function SearchPage() {
  useTitle('Search');
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const { authed, userId } = useAuth();

  const searchBarRef = useRef<SearchBarHandle>(null);

  // Search state
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderName>('anilist');
  const [loadingQuote, setLoadingQuote] = useState('');
  const [isPostFiltered, setIsPostFiltered] = useState(false);

  // Filter state: pending (what user is tweaking) vs applied (what was last sent)
  const [pendingFilters, setPendingFilters] = useState<SearchFilterState>(DEFAULT_FILTER_STATE);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilterState>(DEFAULT_FILTER_STATE);

  // UI state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [watchlistEmpty, setWatchlistEmpty] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('search_view') as 'list' | 'card' | null;
    if (saved) setViewMode(saved);
  }, []);

  // "/" keyboard shortcut to focus search bar
  useEffect(() => {
    function handleSlashKey(e: KeyboardEvent) {
      if (e.key !== '/') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      e.preventDefault();
      searchBarRef.current?.focus();
    }
    document.addEventListener('keydown', handleSlashKey);
    return () => document.removeEventListener('keydown', handleSlashKey);
  }, []);

  // Check if user has any watchlist entries
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('watchlist_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then(({ count }) => {
        setWatchlistEmpty((count ?? 0) === 0);
      });
  }, [userId]);

  // Recommendation state
  const [recsQuote, setRecsQuote] = useState('');
  useEffect(() => { setRecsQuote(getRandomQuote('recommend')); }, []);
  const [trending, setTrending] = useState<AniListMedia[]>([]);
  const [popular, setPopular] = useState<AniListMedia[]>([]);
  const [forYou, setForYou] = useState<AniListMedia[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);

  // Provider capabilities for the active provider
  const activeCapabilities = useMemo<ProviderCapabilities>(() => {
    const all = getAdapterCapabilities();
    return all.find((a) => a.name === activeProvider)?.capabilities ?? {
      q: true, format: true, status: true, yearMin: true, yearMax: true, isAdult: true,
      supportedSorts: ['relevance', 'popularity', 'score', 'start_date_desc', 'start_date_asc', 'title', 'trending'],
      genres: true, excludedGenres: true, scoreMin: true, scoreMax: true,
      tags: true, excludedTags: true, minTagRank: true, season: true, seasonYear: true,
      episodesMin: true, episodesMax: true, durationMin: true, durationMax: true,
      source: true, countryOfOrigin: true, studios: true,
    };
  }, [activeProvider]);

  // Landing view: show when no query and all filters at defaults
  const isLandingView = isDefaultFilters(appliedFilters);

  const activeFilterCount = useMemo(() => countActiveFilters(appliedFilters), [appliedFilters]);

  // Load recommendations on mount
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

  // Load "For You" when authed
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
        // For You is optional
      }
    }
    loadForYou();
  }, [authed, userId]);

  // Refs to read current filter state from stable callbacks
  const appliedRef = useRef(appliedFilters);
  appliedRef.current = appliedFilters;
  const pendingRef = useRef(pendingFilters);
  pendingRef.current = pendingFilters;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Core search function
  const executeSearch = useCallback(async (filters: SearchFilterState) => {
    setLoading(true);
    setLoadingQuote(getRandomQuote('search'));
    const start = Date.now();
    try {
      const result = await searchWithFilters(filters, userIdRef.current);
      setResults(result.results);
      setHasNextPage(result.hasNextPage);
      setTotalCount(result.totalCount);
      setActiveProvider(result.activeProvider);
      setIsPostFiltered(result.isPostFiltered);
    } catch (err) {
      setResults([]);
      setHasNextPage(false);
      setTotalCount(null);
      setIsPostFiltered(false);
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
    const elapsed = Date.now() - start;
    if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
    setLoading(false);
  }, []);

  // Text search — debounced from SearchBar, updates both pending and applied.
  const handleSearch = useCallback((query: string) => {
    const next: SearchFilterState = { ...appliedRef.current, q: query, page: 1 };
    setPendingFilters(next);
    setAppliedFilters(next);
    executeSearch(next);
  }, [executeSearch]);

  // Track query changes for landing view transition
  const handleQueryChange = useCallback((query: string) => {
    setPendingFilters((prev) => ({ ...prev, q: query }));
    if (query === '') {
      const next: SearchFilterState = { ...appliedRef.current, q: '', page: 1 };
      if (isDefaultFilters(next)) {
        setAppliedFilters(next);
        setResults([]);
        setHasNextPage(false);
        setTotalCount(null);
        setFilterPanelOpen(false);
      }
    }
  }, []);

  // Apply filters button
  const handleApplyFilters = useCallback(() => {
    const next: SearchFilterState = { ...pendingRef.current, page: 1 };
    setAppliedFilters(next);
    executeSearch(next);
  }, [executeSearch]);

  // Sort change — updates both pending+applied immediately and triggers search
  const handleSortChange = useCallback((sort: string | null) => {
    const next: SearchFilterState = { ...appliedRef.current, sort, page: 1 };
    setPendingFilters((prev) => ({ ...prev, sort }));
    setAppliedFilters(next);
    executeSearch(next);
  }, [executeSearch]);

  // Clear all filters and search query
  const handleClearFilters = useCallback(() => {
    searchBarRef.current?.clear();
    setPendingFilters(DEFAULT_FILTER_STATE);
    setAppliedFilters(DEFAULT_FILTER_STATE);
    setResults([]);
    setHasNextPage(false);
    setTotalCount(null);
    setFilterPanelOpen(false);
    setIsPostFiltered(false);
  }, []);

  // Reset to landing when user clicks the search nav link while already on /search
  useEffect(() => {
    function onNavReset(e: Event) {
      if ((e as CustomEvent).detail === '/search') handleClearFilters();
    }
    window.addEventListener('nav-reset', onNavReset);
    return () => window.removeEventListener('nav-reset', onNavReset);
  }, [handleClearFilters]);

  // Pagination
  const handlePageChange = useCallback(async (page: number) => {
    const next: SearchFilterState = { ...appliedRef.current, page };
    setAppliedFilters(next);
    setPendingFilters((prev) => ({ ...prev, page }));
    await executeSearch(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [executeSearch]);

  // View mode persistence
  const handleViewModeChange = useCallback((mode: 'list' | 'card') => {
    setViewMode(mode);
    localStorage.setItem('search_view', mode);
  }, []);

  const filteredResults = useMemo(() => {
    const filtered = sfwMode ? results.filter((m) => !m.isAdult) : results;
    const seen = new Set<number>();
    return filtered.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [results, sfwMode]);
  const totalPages = totalCount !== null ? Math.ceil(totalCount / appliedFilters.perPage) : null;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-200 mb-4">Search Anime</h1>
      <div className="mb-6">
        <SearchBar
          ref={searchBarRef}
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          filterPanelOpen={filterPanelOpen}
          onToggleFilterPanel={() => setFilterPanelOpen((v) => !v)}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Filter panel — always accessible */}
      {filterPanelOpen && (
        <FilterPanel
          pending={pendingFilters}
          applied={appliedFilters}
          activeProvider={activeProvider}
          capabilities={activeCapabilities}
          onPendingChange={setPendingFilters}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          watchlistEmpty={watchlistEmpty}
        />
      )}

      {/* Results view */}
      {!isLandingView && (
        <>
          <HeaderStrip
            activeProvider={activeProvider}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            filters={appliedFilters}
            supportedSorts={activeCapabilities.supportedSorts}
            onSortChange={handleSortChange}
          />

          {loading && (
            <div className="text-center py-8">
              <Spinner />
              <p className="text-gray-500 mt-2">Searching...</p>
              <p className="text-base text-gray-400 italic mt-1">{loadingQuote}</p>
            </div>
          )}

          {!loading && filteredResults.length === 0 && (
            <p className="text-gray-500 text-center py-8">No results found.</p>
          )}

          {!loading && filteredResults.length > 0 && (
            <>
              {viewMode === 'list' ? (
                <div className="space-y-2">
                  {filteredResults.map((media) => {
                    const title = media.title.english || media.title.romaji;
                    return (
                      <AnimeCard
                        key={media.id}
                        title={title}
                        coverUrl={media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || ''}
                        status={media.status}
                        episodes={media.episodes}
                        isAdult={media.isAdult}
                        href={`/anime/${media.id}`}
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
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {filteredResults.map((media) => {
                    const title = media.title.english || media.title.romaji;
                    return (
                      <Link
                        key={media.id}
                        href={`/anime/${media.id}`}
                        className={`bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors group ${media.isAdult ? 'border border-red-500/40' : ''}`}
                      >
                        <div className="relative w-full aspect-[3/4]">
                          <Image
                            src={media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '/placeholder.png'}
                            alt={title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}>
                            <AddToPlaylist mediaId={media.id} />
                          </div>
                          <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}>
                            <AddToWatchlist media={media} />
                          </div>
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-gray-200 truncate" title={title}>
                            {title}
                          </p>
                          {media.episodes && (
                            <p className="text-[10px] text-gray-500 mt-0.5">{media.episodes} eps</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {(appliedFilters.page > 1 || hasNextPage) && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => handlePageChange(appliedFilters.page - 1)}
                    disabled={appliedFilters.page <= 1}
                    className="px-3 py-1.5 text-sm bg-[#141925] border border-[#253040] rounded-lg text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {appliedFilters.page}{totalPages !== null ? ` of ${isPostFiltered ? '~' : ''}${totalPages}` : ''}
                  </span>
                  <button
                    onClick={() => handlePageChange(appliedFilters.page + 1)}
                    disabled={!hasNextPage}
                    className="px-3 py-1.5 text-sm bg-[#141925] border border-[#253040] rounded-lg text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Landing view */}
      {isLandingView && !filterPanelOpen && (
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
              />
            )}
            <RecommendationGrid
              title="Trending Now"
              items={sfwMode ? trending.filter((m) => !m.isAdult) : trending}
            />
            <RecommendationGrid
              title="Popular This Season"
              items={sfwMode ? popular.filter((m) => !m.isAdult) : popular}
            />
          </>
        )
      )}
    </div>
  );
}
