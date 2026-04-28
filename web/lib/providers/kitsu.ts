import type { AniListMedia, AnimeDetail } from '@/lib/types';

const KITSU_BASE = 'https://kitsu.io/api/edge';

async function kitsuFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${KITSU_BASE}${path}`, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
  });
  if (!res.ok) {
    throw new Error(`Kitsu API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function mapKitsuStatus(status: string | null): AniListMedia['status'] {
  switch (status) {
    case 'current':
      return 'RELEASING';
    case 'finished':
      return 'FINISHED';
    case 'upcoming':
      return 'NOT_YET_RELEASED';
    case 'unreleased':
      return 'NOT_YET_RELEASED';
    default:
      return 'FINISHED';
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  };
}

export async function searchKitsu(query: string): Promise<AniListMedia[]> {
  try {
    const data = await kitsuFetch<{ data: any[] }>(
      `/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=10`
    );
    return (data.data ?? []).map(mapKitsuToMedia);
  } catch (err) {
    throw new Error(`Kitsu search failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function fetchKitsuDetail(kitsuId: string): Promise<AnimeDetail> {
  try {
    const data = await kitsuFetch<{ data: any }>(`/anime/${kitsuId}`);
    const resource = data.data;
    const attrs = resource.attributes ?? {};
    const poster = attrs.posterImage ?? {};
    const cover = attrs.coverImage ?? {};

    const durationMinutes = typeof attrs.episodeLength === 'number'
      ? attrs.episodeLength
      : null;

    const seasonMap: Record<string, string> = {
      winter: 'WINTER',
      spring: 'SPRING',
      summer: 'SUMMER',
      fall: 'FALL',
    };

    // Parse start date for season/year if available
    let season: string | null = null;
    let seasonYear: number | null = null;
    if (attrs.startDate) {
      const startDate = new Date(attrs.startDate);
      seasonYear = startDate.getFullYear();
      const month = startDate.getMonth();
      if (month >= 0 && month <= 2) season = 'WINTER';
      else if (month >= 3 && month <= 5) season = 'SPRING';
      else if (month >= 6 && month <= 8) season = 'SUMMER';
      else season = 'FALL';
    }

    // Override with explicit season if available from subtype
    if (attrs.season && seasonMap[attrs.season]) {
      season = seasonMap[attrs.season];
    }

    return {
      id: parseInt(resource.id, 10) || 0,
      idMal: null,
      title: {
        romaji: attrs.canonicalTitle ?? attrs.titles?.en_jp ?? '',
        english: attrs.titles?.en ?? null,
        native: attrs.titles?.ja_jp ?? null,
      },
      coverImage: {
        extraLarge: poster.large ?? poster.original ?? '',
        large: poster.large ?? poster.medium ?? '',
        medium: poster.medium ?? poster.small ?? '',
      },
      bannerImage: cover.large ?? cover.original ?? null,
      description: attrs.synopsis ?? null,
      status: mapKitsuStatus(attrs.status ?? null),
      episodes: attrs.episodeCount ?? null,
      duration: durationMinutes,
      season,
      seasonYear,
      genres: [], // Kitsu genres require a separate /anime/{id}/genres request
      isAdult: attrs.nsfw === true || attrs.ageRating === 'R18',
      averageScore: typeof attrs.averageRating === 'string'
        ? Math.round(parseFloat(attrs.averageRating))
        : null,
      studios: { nodes: [] }, // Kitsu studios require a separate relationship request
      nextAiringEpisode: null,
      relations: { edges: [] }, // Skipped per spec — would need /anime/{id}/anime-relations
    };
  } catch (err) {
    throw new Error(`Kitsu detail fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
