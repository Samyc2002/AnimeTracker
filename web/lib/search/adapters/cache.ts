import type { ProviderAdapter, SearchFilterState, SearchResult } from '@/lib/search/types';
import { supabase } from '@/lib/supabase';
import type { AniListMedia } from '@/lib/types';
import { CACHE_SORT_MAP, getEffectiveSort } from '@/lib/search/sort-maps';

interface CacheRow {
  anilist_id: number | null;
  mal_id: number | null;
  title_romaji: string;
  title_english: string | null;
  cover_small: string | null;
  cover_medium: string | null;
  cover_large: string | null;
  status: string;
  episodes: number | null;
  is_adult: boolean;
  season_year: number | null;
}

function rowToMedia(row: CacheRow): AniListMedia {
  return {
    id: row.anilist_id || row.mal_id || 0,
    idMal: row.mal_id,
    title: { romaji: row.title_romaji, english: row.title_english },
    coverImage: {
      extraLarge: row.cover_large || row.cover_medium || '',
      large: row.cover_medium || row.cover_large || '',
      medium: row.cover_small || row.cover_medium || '',
    },
    status: (row.status as AniListMedia['status']) || 'FINISHED',
    episodes: row.episodes,
    isAdult: row.is_adult,
    nextAiringEpisode: null,
    seasonYear: row.season_year,
  };
}

export const cacheAdapter: ProviderAdapter = {
  name: 'anime_cache',
  capabilities: {
    q: true,
    format: false,
    status: true,
    yearMin: true,
    yearMax: true,
    isAdult: true,
    supportedSorts: ['relevance', 'popularity', 'score', 'start_date_desc', 'start_date_asc', 'title'],
    genres: false,
    excludedGenres: false,
    scoreMin: false,
    scoreMax: false,
    tags: false,
    excludedTags: false,
    minTagRank: false,
    season: false,
    seasonYear: false,
    episodesMin: false,
    episodesMax: false,
    durationMin: false,
    durationMax: false,
    source: false,
    countryOfOrigin: false,
    studios: false,
  },
  async search(filters: SearchFilterState): Promise<SearchResult> {
    if (filters.page > 1) throw new Error('Cache only supports page 1');

    let query = supabase
      .from('anime_cache')
      .select('anilist_id, mal_id, title_romaji, title_english, cover_small, cover_medium, cover_large, status, episodes, is_adult, season_year');

    if (filters.q) {
      query = query.ilike('title_romaji', `%${filters.q}%`);
    }
    if (filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters.yearMin !== null) {
      query = query.gte('season_year', filters.yearMin);
    }
    if (filters.yearMax !== null) {
      query = query.lte('season_year', filters.yearMax);
    }
    if (!filters.isAdult) {
      query = query.eq('is_adult', false);
    }

    const effective = getEffectiveSort(filters);
    const cacheSort = CACHE_SORT_MAP[effective];
    if (cacheSort?.column) {
      query = query.order(cacheSort.column, { ascending: cacheSort.ascending });
    }

    query = query.limit(filters.perPage);

    const { data, error } = await query;
    if (error) throw new Error(`Cache query failed: ${error.message}`);
    if (!data) throw new Error('Cache query returned null');
    if (data.length === 0) return { results: [], totalCount: 0, hasNextPage: false };

    return {
      results: (data as unknown as CacheRow[]).map(rowToMedia),
      totalCount: null,
      hasNextPage: false,
    };
  },
};
