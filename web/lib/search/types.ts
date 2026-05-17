import type { AniListMedia } from '@/lib/types';

export type ProviderName = 'anilist' | 'jikan' | 'kitsu' | 'anime_cache';

export interface SearchFilterState {
  q: string;
  format: string[];
  status: string[];
  yearMin: number | null;
  yearMax: number | null;
  isAdult: boolean;
  sort: string | null;
  page: number;
  perPage: number;
  // Tier B
  genres: string[];
  excludedGenres: string[];
  scoreMin: number | null;
  scoreMax: number | null;
  // Tier C
  tags: string[];
  excludedTags: string[];
  minTagRank: number;
  season: string | null;
  seasonYear: number | null;
  episodesMin: number | null;
  episodesMax: number | null;
  durationMin: number | null;
  durationMax: number | null;
  source: string[];
  countryOfOrigin: string | null;
  studios: number[];
  // Watchlist exclude
  excludeWatchlistStatuses: string[];
}

export const DEFAULT_FILTER_STATE: SearchFilterState = {
  q: '',
  format: [],
  status: [],
  yearMin: null,
  yearMax: null,
  isAdult: false,
  sort: null,
  page: 1,
  perPage: 15,
  genres: [],
  excludedGenres: [],
  scoreMin: null,
  scoreMax: null,
  tags: [],
  excludedTags: [],
  minTagRank: 60,
  season: null,
  seasonYear: null,
  episodesMin: null,
  episodesMax: null,
  durationMin: null,
  durationMax: null,
  source: [],
  countryOfOrigin: null,
  studios: [],
  excludeWatchlistStatuses: [],
};

export interface SearchResult {
  results: AniListMedia[];
  totalCount: number | null;
  hasNextPage: boolean;
}

export interface ProviderCapabilities {
  q: boolean;
  format: boolean;
  status: boolean;
  yearMin: boolean;
  yearMax: boolean;
  isAdult: boolean;
  supportedSorts: string[];
  genres: boolean;
  excludedGenres: boolean;
  scoreMin: boolean;
  scoreMax: boolean;
  tags: boolean;
  excludedTags: boolean;
  minTagRank: boolean;
  season: boolean;
  seasonYear: boolean;
  episodesMin: boolean;
  episodesMax: boolean;
  durationMin: boolean;
  durationMax: boolean;
  source: boolean;
  countryOfOrigin: boolean;
  studios: boolean;
}

export interface ProviderAdapter {
  name: ProviderName;
  capabilities: ProviderCapabilities;
  search(filters: SearchFilterState, options?: { excludedIds?: number[] }): Promise<SearchResult>;
}

export interface OrchestratorResult extends SearchResult {
  activeProvider: ProviderName;
  isPostFiltered: boolean;
}

export const FORMAT_OPTIONS = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'MUSIC'] as const;
export const STATUS_OPTIONS = ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED'] as const;

export const SOURCE_OPTIONS = [
  'ORIGINAL', 'MANGA', 'LIGHT_NOVEL', 'VISUAL_NOVEL', 'VIDEO_GAME',
  'NOVEL', 'DOUJINSHI', 'ANIME', 'WEB_NOVEL', 'LIVE_ACTION',
  'GAME', 'COMIC', 'MULTIMEDIA_PROJECT', 'PICTURE_BOOK', 'OTHER',
] as const;

export const SOURCE_LABELS: Record<string, string> = {
  ORIGINAL: 'Original',
  MANGA: 'Manga',
  LIGHT_NOVEL: 'Light Novel',
  VISUAL_NOVEL: 'Visual Novel',
  VIDEO_GAME: 'Video Game',
  NOVEL: 'Novel',
  DOUJINSHI: 'Doujinshi',
  ANIME: 'Anime',
  WEB_NOVEL: 'Web Novel',
  LIVE_ACTION: 'Live Action',
  GAME: 'Game',
  COMIC: 'Comic',
  MULTIMEDIA_PROJECT: 'Multimedia Project',
  PICTURE_BOOK: 'Picture Book',
  OTHER: 'Other',
};

export const SEASON_OPTIONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const;

export const COUNTRY_OPTIONS = [
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'KR', label: 'South Korea' },
  { value: 'TW', label: 'Taiwan' },
] as const;

function sortedEq(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function sortedNumEq(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

export function filtersChanged(a: SearchFilterState, b: SearchFilterState): boolean {
  return (
    a.yearMin !== b.yearMin ||
    a.yearMax !== b.yearMax ||
    a.isAdult !== b.isAdult ||
    a.scoreMin !== b.scoreMin ||
    a.scoreMax !== b.scoreMax ||
    a.minTagRank !== b.minTagRank ||
    a.season !== b.season ||
    a.seasonYear !== b.seasonYear ||
    a.episodesMin !== b.episodesMin ||
    a.episodesMax !== b.episodesMax ||
    a.durationMin !== b.durationMin ||
    a.durationMax !== b.durationMax ||
    a.sort !== b.sort ||
    a.countryOfOrigin !== b.countryOfOrigin ||
    !sortedEq(a.format, b.format) ||
    !sortedEq(a.status, b.status) ||
    !sortedEq(a.genres, b.genres) ||
    !sortedEq(a.excludedGenres, b.excludedGenres) ||
    !sortedEq(a.tags, b.tags) ||
    !sortedEq(a.excludedTags, b.excludedTags) ||
    !sortedEq(a.source, b.source) ||
    !sortedNumEq(a.studios, b.studios) ||
    !sortedEq(a.excludeWatchlistStatuses, b.excludeWatchlistStatuses)
  );
}

export function isDefaultFilters(state: SearchFilterState): boolean {
  return (
    state.sort === null &&
    state.q === '' &&
    state.format.length === 0 &&
    state.status.length === 0 &&
    state.yearMin === null &&
    state.yearMax === null &&
    state.isAdult === false &&
    state.genres.length === 0 &&
    state.excludedGenres.length === 0 &&
    state.scoreMin === null &&
    state.scoreMax === null &&
    state.tags.length === 0 &&
    state.excludedTags.length === 0 &&
    state.minTagRank === 60 &&
    state.season === null &&
    state.seasonYear === null &&
    state.episodesMin === null &&
    state.episodesMax === null &&
    state.durationMin === null &&
    state.durationMax === null &&
    state.source.length === 0 &&
    state.countryOfOrigin === null &&
    state.studios.length === 0 &&
    state.excludeWatchlistStatuses.length === 0
  );
}
