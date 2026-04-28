import type { AniListMedia, AnimeDetail, AiringSchedule } from '@/lib/types';
import { searchAnilist, fetchAnilistDetail, fetchAnilistWeeklyAiring, fetchAnilistRecommendations, fetchAnilistViewer, fetchAnilistUserList, fetchAnilistAiringSchedule } from '@/lib/providers/anilist';
import { searchJikan, fetchJikanDetail, fetchJikanSchedule } from '@/lib/providers/jikan';
import { searchKitsu, fetchKitsuDetail } from '@/lib/providers/kitsu';
import { getCachedAnime, getCachedSearch, saveAnimeToCache, saveMultipleToCache } from '@/lib/providers/cache';
import { getCachedAiring, saveAiringToCache } from '@/lib/providers/airing-cache';

export type { AniListUserEntry } from '@/lib/providers/anilist';
export { ANILIST_STATUS_MAP } from '@/lib/providers/anilist';

export function getErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Something went wrong';
  if (err.message.includes('Rate limited')) return 'Too many requests — please wait a moment and try again';
  return err.message;
}

async function tryProviders<T>(
  label: string,
  ...attempts: (() => Promise<T>)[]
): Promise<T> {
  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error(`All providers failed for ${label}`);
}

export async function searchAnime(search: string): Promise<AniListMedia[]> {
  const cached = await getCachedSearch(search);
  if (cached.length > 0) return cached;

  const results = await tryProviders(
    'search',
    () => searchAnilist(search),
    () => searchJikan(search),
    () => searchKitsu(search),
  );

  const details = results.map(m => ({
    id: m.id,
    idMal: m.idMal,
    title: { romaji: m.title.romaji, english: m.title.english, native: null },
    coverImage: m.coverImage,
    bannerImage: null,
    description: null,
    status: m.status,
    episodes: m.episodes,
    duration: null,
    season: null,
    seasonYear: null,
    genres: [],
    isAdult: m.isAdult,
    averageScore: null,
    studios: { nodes: [] },
    nextAiringEpisode: m.nextAiringEpisode ? { ...m.nextAiringEpisode, timeUntilAiring: 0 } : null,
    relations: { edges: [] },
  } as AnimeDetail));
  saveMultipleToCache(details).catch(() => {});

  return results;
}

export async function fetchAnimeDetail(id: number): Promise<AnimeDetail> {
  const cached = await getCachedAnime({ anilistId: id }) || await getCachedAnime({ malId: id });
  if (cached && !cached.stale) return cached.detail;

  const detail = await tryProviders(
    'detail',
    () => fetchAnilistDetail(id),
    async () => {
      const malId = cached?.detail?.idMal || id;
      try {
        return await fetchJikanDetail(malId);
      } catch {
        const title = cached?.detail?.title?.romaji;
        if (title) {
          const results = await searchJikan(title);
          if (results.length > 0) return fetchJikanDetail(results[0].idMal || results[0].id);
        }
        throw new Error('Not found on Jikan');
      }
    },
    async () => {
      const title = cached?.detail?.title?.romaji;
      if (title) {
        const results = await searchKitsu(title);
        if (results.length > 0) return fetchKitsuDetail(String(results[0].id));
      }
      throw new Error('Not found on Kitsu');
    },
  );

  saveAnimeToCache(detail).catch(() => {});
  return detail;
}

export async function fetchAiringSchedule(
  mediaIds: number[],
  fromTimestamp: number,
  toTimestamp: number,
): Promise<AiringSchedule[]> {
  return fetchAnilistAiringSchedule(mediaIds, fromTimestamp, toTimestamp);
}

export { getCachedAiring, saveAiringToCache } from '@/lib/providers/airing-cache';

export async function fetchWeeklyAiring(
  fromTimestamp: number,
  toTimestamp: number,
  page: number = 1,
): Promise<{ schedules: AiringSchedule[]; hasNextPage: boolean }> {
  try {
    return await fetchAnilistWeeklyAiring(fromTimestamp, toTimestamp, page);
  } catch {
    if (page > 1) return { schedules: [], hasNextPage: false };
    try {
      const schedules = await fetchJikanSchedule();
      return { schedules, hasNextPage: false };
    } catch {
      return { schedules: [], hasNextPage: false };
    }
  }
}

export async function fetchRecommendations(): Promise<{ trending: AniListMedia[]; popular: AniListMedia[] }> {
  try {
    return await fetchAnilistRecommendations();
  } catch {
    try {
      const jikanRes = await fetch('https://api.jikan.moe/v4/top/anime?filter=airing&limit=10');
      if (!jikanRes.ok) throw new Error('Jikan top failed');
      const jikanData = await jikanRes.json();
      const trending: AniListMedia[] = (jikanData.data || []).map((item: Record<string, unknown>) => ({
        id: item.mal_id as number,
        idMal: item.mal_id as number,
        title: { romaji: item.title as string, english: (item.title_english as string) || null },
        coverImage: {
          extraLarge: ((item.images as Record<string, Record<string, string>>)?.jpg?.large_image_url) || '',
          large: ((item.images as Record<string, Record<string, string>>)?.jpg?.large_image_url) || '',
          medium: ((item.images as Record<string, Record<string, string>>)?.jpg?.image_url) || '',
        },
        status: 'RELEASING' as const,
        episodes: (item.episodes as number) || null,
        isAdult: false,
        nextAiringEpisode: null,
      }));
      return { trending, popular: trending };
    } catch {
      return { trending: [], popular: [] };
    }
  }
}

export async function fetchViewer(token: string): Promise<{ id: number; name: string }> {
  return fetchAnilistViewer(token);
}

export async function fetchUserList(userId: number, token: string) {
  return fetchAnilistUserList(userId, token);
}

export function mediaToWatchlistEntry(media: AniListMedia) {
  return {
    media_id: media.id,
    id_mal: media.idMal,
    title_romaji: media.title.romaji,
    title_english: media.title.english,
    cover_url: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '',
    status: media.status,
    total_episodes: media.episodes,
    next_airing_episode: media.nextAiringEpisode?.episode ?? null,
    next_airing_at: media.nextAiringEpisode?.airingAt ?? null,
    watch_status: 'Watching',
    is_adult: media.isAdult ?? false,
  };
}
