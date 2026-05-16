import type { AniListMedia } from '@/lib/types';
import type { ProviderAdapter, SearchFilterState, SearchResult } from '@/lib/search/types';
import { ANILIST_FORMAT_MAP, ANILIST_STATUS_MAP } from '@/lib/search/enum-maps';
import { ANILIST_SORT_MAP, getEffectiveSort } from '@/lib/search/sort-maps';

const ANILIST_API = 'https://graphql.anilist.co';

const FILTERED_SEARCH_QUERY = `
query FilteredSearchPaginated(
  $search: String,
  $page: Int,
  $perPage: Int,
  $format_in: [MediaFormat],
  $status_in: [MediaStatus],
  $startDate_greater: FuzzyDateInt,
  $startDate_lesser: FuzzyDateInt,
  $isAdult: Boolean,
  $genre_in: [String],
  $genre_not_in: [String],
  $averageScore_greater: Int,
  $averageScore_lesser: Int,
  $tag_in: [String],
  $tag_not_in: [String],
  $minimumTagRank: Int,
  $season: MediaSeason,
  $seasonYear: Int,
  $episodes_greater: Int,
  $episodes_lesser: Int,
  $duration_greater: Int,
  $duration_lesser: Int,
  $source_in: [MediaSource],
  $countryOfOrigin: CountryCode,
  $licensedById_in: [Int],
  $sort: [MediaSort],
  $id_not_in: [Int]
) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total hasNextPage }
    media(
      sort: $sort,
      id_not_in: $id_not_in,
      search: $search,
      type: ANIME,
      format_in: $format_in,
      status_in: $status_in,
      startDate_greater: $startDate_greater,
      startDate_lesser: $startDate_lesser,
      isAdult: $isAdult,
      genre_in: $genre_in,
      genre_not_in: $genre_not_in,
      averageScore_greater: $averageScore_greater,
      averageScore_lesser: $averageScore_lesser,
      tag_in: $tag_in,
      tag_not_in: $tag_not_in,
      minimumTagRank: $minimumTagRank,
      season: $season,
      seasonYear: $seasonYear,
      episodes_greater: $episodes_greater,
      episodes_lesser: $episodes_lesser,
      duration_greater: $duration_greater,
      duration_lesser: $duration_lesser,
      source_in: $source_in,
      countryOfOrigin: $countryOfOrigin,
      licensedById_in: $licensedById_in
    ) {
      id
      idMal
      title { romaji english }
      coverImage { extraLarge large medium }
      status
      episodes
      isAdult
      nextAiringEpisode { airingAt episode }
      genres
      tags { name rank }
      studios(isMain: true) { nodes { name id } }
      format
      season
      seasonYear
      source
      duration
      averageScore
      popularity
    }
  }
}`;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '0') || (attempt + 1) * 2;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      throw new Error('Rate limited by AniList. Please wait a moment and try again.');
    }

    if (!res.ok) throw new Error(`AniList API error: ${res.status}`);

    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data;
  }
  throw new Error('Max retries exceeded');
}

export const anilistAdapter: ProviderAdapter = {
  name: 'anilist',
  capabilities: {
    q: true,
    format: true,
    status: true,
    yearMin: true,
    yearMax: true,
    isAdult: true,
    supportedSorts: ['relevance', 'popularity', 'score', 'start_date_desc', 'start_date_asc', 'title', 'trending'],
    genres: true,
    excludedGenres: true,
    scoreMin: true,
    scoreMax: true,
    tags: true,
    excludedTags: true,
    minTagRank: true,
    season: true,
    seasonYear: true,
    episodesMin: true,
    episodesMax: true,
    durationMin: true,
    durationMax: true,
    source: true,
    countryOfOrigin: true,
    studios: true,
  },
  async search(filters: SearchFilterState, options?: { excludedIds?: number[] }): Promise<SearchResult> {
    const variables: Record<string, unknown> = {
      page: filters.page,
      perPage: filters.perPage,
      isAdult: filters.isAdult,
    };

    if (filters.q) variables.search = filters.q;
    if (filters.format.length > 0) {
      variables.format_in = filters.format.map((f) => ANILIST_FORMAT_MAP[f]).filter(Boolean);
    }
    if (filters.status.length > 0) {
      variables.status_in = filters.status.map((s) => ANILIST_STATUS_MAP[s]).filter(Boolean);
    }
    if (filters.yearMin !== null) variables.startDate_greater = (filters.yearMin - 1) * 10000 + 1231;
    if (filters.yearMax !== null) variables.startDate_lesser = (filters.yearMax + 1) * 10000 + 101;
    if (filters.genres.length > 0) variables.genre_in = filters.genres;
    if (filters.excludedGenres.length > 0) variables.genre_not_in = filters.excludedGenres;
    if (filters.scoreMin !== null) variables.averageScore_greater = Math.round(filters.scoreMin * 10) - 1;
    if (filters.scoreMax !== null) variables.averageScore_lesser = Math.round(filters.scoreMax * 10) + 1;
    if (filters.tags.length > 0) variables.tag_in = filters.tags;
    if (filters.excludedTags.length > 0) variables.tag_not_in = filters.excludedTags;
    if (filters.tags.length > 0 || filters.excludedTags.length > 0) {
      variables.minimumTagRank = filters.minTagRank;
    }
    // Season + seasonYear must both be set for AniList
    if (filters.season && filters.seasonYear !== null) {
      variables.season = filters.season;
      variables.seasonYear = filters.seasonYear;
    }
    if (filters.episodesMin !== null) variables.episodes_greater = filters.episodesMin - 1;
    if (filters.episodesMax !== null) variables.episodes_lesser = filters.episodesMax + 1;
    if (filters.durationMin !== null) variables.duration_greater = filters.durationMin - 1;
    if (filters.durationMax !== null) variables.duration_lesser = filters.durationMax + 1;
    if (filters.source.length > 0) variables.source_in = filters.source;
    if (filters.countryOfOrigin) variables.countryOfOrigin = filters.countryOfOrigin;
    if (filters.studios.length > 0) variables.licensedById_in = filters.studios;

    const effective = getEffectiveSort(filters);
    const anilistSort = ANILIST_SORT_MAP[effective];
    if (anilistSort) variables.sort = [anilistSort];

    if (options?.excludedIds && options.excludedIds.length > 0) {
      variables.id_not_in = options.excludedIds;
    }

    const data = await gql<{
      Page: {
        pageInfo: { total: number; hasNextPage: boolean };
        media: AniListMedia[];
      };
    }>(FILTERED_SEARCH_QUERY, variables);

    return {
      results: data.Page.media,
      totalCount: data.Page.pageInfo.total,
      hasNextPage: data.Page.pageInfo.hasNextPage,
    };
  },
};
