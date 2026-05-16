import type { AniListMedia } from '@/lib/types';
import type { ProviderAdapter, SearchFilterState, SearchResult } from '@/lib/search/types';
import { JIKAN_FORMAT_MAP, JIKAN_STATUS_MAP } from '@/lib/search/enum-maps';
import { getMalId } from '@/lib/search/genre-map';
import { JIKAN_SORT_MAP, getEffectiveSort } from '@/lib/search/sort-maps';

const JIKAN_BASE = 'https://api.jikan.moe/v4';

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

function mapJikanStatus(status: string): AniListMedia['status'] {
  switch (status) {
    case 'Currently Airing': return 'RELEASING';
    case 'Finished Airing': return 'FINISHED';
    case 'Not yet aired': return 'NOT_YET_RELEASED';
    default: return 'FINISHED';
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapJikanToMedia(item: any): AniListMedia {
  return {
    id: item.mal_id,
    idMal: item.mal_id,
    title: {
      romaji: item.title ?? '',
      english: item.title_english ?? null,
    },
    coverImage: {
      extraLarge: item.images?.jpg?.large_image_url ?? '',
      large: item.images?.jpg?.large_image_url ?? '',
      medium: item.images?.jpg?.image_url ?? '',
    },
    status: mapJikanStatus(item.status ?? ''),
    episodes: item.episodes ?? null,
    isAdult: typeof item.rating === 'string' && item.rating.includes('Rx'),
    nextAiringEpisode: null,
    format: item.type ?? null,
    seasonYear: item.year ?? null,
    averageScore: typeof item.score === 'number' ? Math.round(item.score * 10) : null,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

function genreNamesToMalIds(genres: string[]): string {
  return genres.map(getMalId).filter((id): id is number => id !== null).join(',');
}

export const jikanAdapter: ProviderAdapter = {
  name: 'jikan',
  capabilities: {
    q: true,
    format: true,
    status: true,
    yearMin: true,
    yearMax: true,
    isAdult: true,
    supportedSorts: ['relevance', 'popularity', 'score', 'start_date_desc', 'start_date_asc', 'title'],
    genres: true,
    excludedGenres: true,
    scoreMin: true,
    scoreMax: true,
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
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL) {
      await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
    }
    lastRequestTime = Date.now();

    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    params.set('limit', String(filters.perPage));
    params.set('page', String(filters.page));

    if (filters.format.length === 1) {
      const mapped = JIKAN_FORMAT_MAP[filters.format[0]];
      if (mapped) params.set('type', mapped);
    }
    if (filters.status.length === 1) {
      const mapped = JIKAN_STATUS_MAP[filters.status[0]];
      if (mapped) params.set('status', mapped);
    }
    if (filters.yearMin !== null) params.set('start_date', `${filters.yearMin}-01-01`);
    if (filters.yearMax !== null) params.set('end_date', `${filters.yearMax}-12-31`);
    if (filters.isAdult) {
      params.set('rating', 'rx');
    } else {
      params.set('sfw', 'true');
    }

    if (filters.genres.length > 0) {
      const ids = genreNamesToMalIds(filters.genres);
      if (ids) params.set('genres', ids);
    }
    if (filters.excludedGenres.length > 0) {
      const ids = genreNamesToMalIds(filters.excludedGenres);
      if (ids) params.set('genres_exclude', ids);
    }
    if (filters.scoreMin !== null) params.set('min_score', String(filters.scoreMin));
    if (filters.scoreMax !== null) params.set('max_score', String(filters.scoreMax));

    const effective = getEffectiveSort(filters);
    const jikanSort = JIKAN_SORT_MAP[effective];
    if (jikanSort?.order_by) {
      params.set('order_by', jikanSort.order_by);
      params.set('sort', jikanSort.sort);
    }

    const res = await fetch(`${JIKAN_BASE}/anime?${params.toString()}`);
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2');
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      throw new Error('Rate limited by Jikan');
    }
    if (!res.ok) throw new Error(`Jikan API error: ${res.status}`);

    const data = await res.json();
    return {
      results: (data.data ?? []).map(mapJikanToMedia),
      totalCount: data.pagination?.items?.total ?? null,
      hasNextPage: data.pagination?.has_next_page ?? false,
    };
  },
};
