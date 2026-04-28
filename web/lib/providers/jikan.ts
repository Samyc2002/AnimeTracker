import type { AniListMedia, AnimeDetail, AiringSchedule } from '@/lib/types';

const JIKAN_BASE = 'https://api.jikan.moe/v4';

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 333; // ~3 req/sec rate limit

async function jikanFetch<T>(path: string): Promise<T> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();

  const res = await fetch(`${JIKAN_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Jikan API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function mapJikanStatus(status: string): AniListMedia['status'] {
  switch (status) {
    case 'Currently Airing':
      return 'RELEASING';
    case 'Finished Airing':
      return 'FINISHED';
    case 'Not yet aired':
      return 'NOT_YET_RELEASED';
    default:
      return 'FINISHED';
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
  };
}

function mapJikanRelationType(relation: string): string {
  const map: Record<string, string> = {
    'Prequel': 'PREQUEL',
    'Sequel': 'SEQUEL',
    'Side Story': 'SIDE_STORY',
    'Side story': 'SIDE_STORY',
    'Parent Story': 'PARENT',
    'Parent story': 'PARENT',
    'Alternative Setting': 'ALTERNATIVE',
    'Alternative Version': 'ALTERNATIVE',
    'Alternative version': 'ALTERNATIVE',
    'Spin-Off': 'SPIN_OFF',
    'Spin-off': 'SPIN_OFF',
    'Summary': 'SUMMARY',
    'Adaptation': 'ADAPTATION',
    'Character': 'CHARACTER',
    'Other': 'OTHER',
    'Full Story': 'PARENT',
    'Full story': 'PARENT',
  };
  return map[relation] ?? 'OTHER';
}

function parseDuration(durationStr: string | null | undefined): number | null {
  if (!durationStr) return null;
  const match = durationStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export async function searchJikan(query: string): Promise<AniListMedia[]> {
  try {
    const data = await jikanFetch<{ data: any[] }>(
      `/anime?q=${encodeURIComponent(query)}&limit=10`
    );
    return (data.data ?? []).map(mapJikanToMedia);
  } catch (err) {
    throw new Error(`Jikan search failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function fetchJikanDetail(malId: number): Promise<AnimeDetail> {
  try {
    const data = await jikanFetch<{ data: any }>(`/anime/${malId}/full`);
    const item = data.data;

    const relations: AnimeDetail['relations']['edges'] = [];
    if (Array.isArray(item.relations)) {
      for (const rel of item.relations) {
        const relationType = mapJikanRelationType(rel.relation ?? '');
        for (const entry of rel.entry ?? []) {
          if (entry.type !== 'anime') continue;
          relations.push({
            relationType,
            node: {
              id: entry.mal_id,
              title: {
                romaji: entry.name ?? '',
                english: null,
              },
              coverImage: {
                extraLarge: '',
                large: '',
                medium: '',
              },
              type: 'ANIME',
              status: '',
            },
          });
        }
      }
    }

    return {
      id: item.mal_id,
      idMal: item.mal_id,
      title: {
        romaji: item.title ?? '',
        english: item.title_english ?? null,
        native: item.title_japanese ?? null,
      },
      coverImage: {
        extraLarge: item.images?.jpg?.large_image_url ?? '',
        large: item.images?.jpg?.large_image_url ?? '',
        medium: item.images?.jpg?.image_url ?? '',
      },
      bannerImage: null,
      description: item.synopsis ?? null,
      status: mapJikanStatus(item.status ?? ''),
      episodes: item.episodes ?? null,
      duration: parseDuration(item.duration),
      season: item.season ?? null,
      seasonYear: item.year ?? null,
      genres: (item.genres ?? []).map((g: any) => g.name),
      isAdult: typeof item.rating === 'string' && item.rating.includes('Rx'),
      averageScore: typeof item.score === 'number' ? Math.round(item.score * 10) : null,
      studios: {
        nodes: (item.studios ?? []).slice(0, 1).map((s: any) => ({ name: s.name ?? '' })),
      },
      nextAiringEpisode: null,
      relations: { edges: relations },
    };
  } catch (err) {
    throw new Error(`Jikan detail fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const DAY_MAP: Record<string, number> = {
  'Sundays': 0, 'Mondays': 1, 'Tuesdays': 2, 'Wednesdays': 3,
  'Thursdays': 4, 'Fridays': 5, 'Saturdays': 6,
};

function computeAiringTimestamp(broadcast: { day?: string; time?: string; timezone?: string } | null): number {
  if (!broadcast?.day || !broadcast?.time) return 0;
  const dayNum = DAY_MAP[broadcast.day];
  if (dayNum === undefined) return 0;

  const [hours, minutes] = broadcast.time.split(':').map(Number);
  const now = new Date();
  const currentDay = now.getDay();
  let diff = dayNum - currentDay;
  if (diff < 0) diff += 7;

  const airDate = new Date(now);
  airDate.setDate(now.getDate() + diff);
  airDate.setHours(hours, minutes, 0, 0);

  const jstOffset = 9 * 60;
  const localOffset = airDate.getTimezoneOffset();
  airDate.setMinutes(airDate.getMinutes() - jstOffset - localOffset);

  return Math.floor(airDate.getTime() / 1000);
}

export async function fetchJikanSchedule(dayOfWeek?: string): Promise<AiringSchedule[]> {
  try {
    const allItems: AiringSchedule[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
      const filter = dayOfWeek ? `filter=${dayOfWeek.toLowerCase()}&` : '';
      const data = await jikanFetch<{
        data: any[];
        pagination: { has_next_page: boolean };
      }>(`/schedules?${filter}page=${page}&limit=25`);

      const items = (data.data ?? []).map((item: any) => ({
        mediaId: item.mal_id,
        episode: item.episodes ?? 0,
        airingAt: computeAiringTimestamp(item.broadcast),
        media: mapJikanToMedia(item),
      }));
      allItems.push(...items);
      hasMore = data.pagination?.has_next_page ?? false;
      page++;
    }

    return allItems;
  } catch (err) {
    throw new Error(`Jikan schedule fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
