export type { AniListMedia, AnimeDetail, AiringSchedule, WatchStatus } from '@/lib/types';

export interface ProviderResult<T> {
  data: T;
  source: 'cache' | 'anilist' | 'jikan' | 'kitsu';
}
