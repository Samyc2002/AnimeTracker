import type { SearchFilterState } from '@/lib/search/types';

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'score', label: 'Score' },
  { value: 'start_date_desc', label: 'Newest First' },
  { value: 'start_date_asc', label: 'Oldest First' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'trending', label: 'Trending' },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export const ANILIST_SORT_MAP: Record<string, string> = {
  relevance: 'SEARCH_MATCH',
  popularity: 'POPULARITY_DESC',
  score: 'SCORE_DESC',
  start_date_desc: 'START_DATE_DESC',
  start_date_asc: 'START_DATE',
  title: 'TITLE_ROMAJI',
  trending: 'TRENDING_DESC',
};

export const JIKAN_SORT_MAP: Record<string, { order_by: string; sort: string }> = {
  relevance: { order_by: '', sort: '' },
  popularity: { order_by: 'popularity', sort: 'asc' },
  score: { order_by: 'score', sort: 'desc' },
  start_date_desc: { order_by: 'start_date', sort: 'desc' },
  start_date_asc: { order_by: 'start_date', sort: 'asc' },
  title: { order_by: 'title', sort: 'asc' },
};

export const KITSU_SORT_MAP: Record<string, string> = {
  relevance: '',
  popularity: '-userCount',
  score: '-averageRating',
  start_date_desc: '-startDate',
  start_date_asc: 'startDate',
  title: 'titles.canonical',
};

export const CACHE_SORT_MAP: Record<string, { column: string; ascending: boolean }> = {
  relevance: { column: '', ascending: true },
  popularity: { column: 'average_score', ascending: false },
  score: { column: 'average_score', ascending: false },
  start_date_desc: { column: 'season_year', ascending: false },
  start_date_asc: { column: 'season_year', ascending: true },
  title: { column: 'title_romaji', ascending: true },
};

export function getEffectiveSort(filters: SearchFilterState): SortValue {
  if (filters.sort !== null) return filters.sort as SortValue;
  return filters.q ? 'relevance' : 'popularity';
}
