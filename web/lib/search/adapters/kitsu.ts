import type { AniListMedia } from '@/lib/types';
import type { ProviderAdapter, SearchFilterState, SearchResult } from '@/lib/search/types';
import { KITSU_FORMAT_MAP, KITSU_STATUS_MAP } from '@/lib/search/enum-maps';
import { KITSU_SORT_MAP, getEffectiveSort } from '@/lib/search/sort-maps';

const KITSU_BASE = 'https://kitsu.io/api/edge';

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapKitsuStatus(status: string | null): AniListMedia['status'] {
  switch (status) {
    case 'current': return 'RELEASING';
    case 'finished': return 'FINISHED';
    case 'upcoming': return 'NOT_YET_RELEASED';
    case 'unreleased': return 'NOT_YET_RELEASED';
    default: return 'FINISHED';
  }
}

function mapKitsuToMedia(resource: any): AniListMedia {
  const attrs = resource.attributes ?? {};
  const poster = attrs.posterImage ?? {};
  return {
    id: parseInt(resource.id, 10) || 0,
    idMal: null,
    title: {
      romaji: attrs.canonicalTitle ?? attrs.titles?.en_jp ?? '',
      english: attrs.titles?.en ?? null,
    },
    coverImage: {
      extraLarge: poster.large ?? poster.original ?? '',
      large: poster.large ?? poster.medium ?? '',
      medium: poster.medium ?? poster.small ?? '',
    },
    status: mapKitsuStatus(attrs.status ?? null),
    episodes: attrs.episodeCount ?? null,
    isAdult: attrs.nsfw === true,
    nextAiringEpisode: null,
    format: attrs.subtype ?? null,
    seasonYear: attrs.startDate ? new Date(attrs.startDate).getFullYear() : null,
    averageScore: typeof attrs.averageRating === 'string' ? Math.round(parseFloat(attrs.averageRating)) : null,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export const kitsuAdapter: ProviderAdapter = {
  name: 'kitsu',
  capabilities: {
    q: true,
    format: true,
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
    const offset = (filters.page - 1) * filters.perPage;
    const params = new URLSearchParams();

    if (filters.q) params.set('filter[text]', filters.q);
    params.set('page[limit]', String(filters.perPage));
    params.set('page[offset]', String(offset));

    if (filters.format.length === 1) {
      const mapped = KITSU_FORMAT_MAP[filters.format[0]];
      if (mapped) params.set('filter[subtype]', mapped);
    }
    if (filters.status.length === 1) {
      const mapped = KITSU_STATUS_MAP[filters.status[0]];
      if (mapped) params.set('filter[status]', mapped);
    }
    if (filters.yearMin !== null && filters.yearMax !== null) {
      params.set('filter[seasonYear]', `${filters.yearMin}..${filters.yearMax}`);
    } else if (filters.yearMin !== null) {
      params.set('filter[seasonYear]', `${filters.yearMin}..`);
    } else if (filters.yearMax !== null) {
      params.set('filter[seasonYear]', `..${filters.yearMax}`);
    }

    const effective = getEffectiveSort(filters);
    const kitsuSort = KITSU_SORT_MAP[effective];
    if (kitsuSort) params.set('sort', kitsuSort);

    const res = await fetch(`${KITSU_BASE}/anime?${params.toString()}`, {
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
    });
    if (!res.ok) throw new Error(`Kitsu API error: ${res.status}`);

    const data = await res.json();
    return {
      results: (data.data ?? []).map(mapKitsuToMedia),
      totalCount: data.meta?.count ?? null,
      hasNextPage: !!data.links?.next,
    };
  },
};
