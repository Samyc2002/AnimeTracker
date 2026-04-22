import type { AniListMedia, AiringSchedule, AnimeDetail } from './types';

const ANILIST_API = 'https://graphql.anilist.co';

const SEARCH_QUERY = `
query SearchAnime($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME) {
      id
      idMal
      title { romaji english }
      coverImage { medium }
      status
      episodes
      nextAiringEpisode {
        airingAt
        episode
      }
    }
  }
}`;

const AIRING_QUERY = `
query AiringSchedule($mediaIds: [Int], $from: Int, $to: Int) {
  Page(perPage: 50) {
    airingSchedules(
      mediaId_in: $mediaIds,
      airingAt_greater: $from,
      airingAt_lesser: $to
    ) {
      mediaId
      episode
      airingAt
    }
  }
}`;

const WEEKLY_AIRING_QUERY = `
query WeeklyAiring($from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
    }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      mediaId
      episode
      airingAt
      media {
        id
        idMal
        title { romaji english }
        coverImage { medium }
        status
        episodes
      }
    }
  }
}`;

const ANIME_DETAIL_QUERY = `
query AnimeDetail($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title { romaji english native }
    coverImage { large medium }
    bannerImage
    description(asHtml: false)
    status
    episodes
    duration
    season
    seasonYear
    genres
    averageScore
    studios(isMain: true) { nodes { name } }
    nextAiringEpisode { airingAt episode timeUntilAiring }
    relations {
      edges {
        relationType
        node {
          id
          title { romaji english }
          coverImage { medium }
          type
          status
        }
      }
    }
  }
}`;

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`AniList API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

export async function searchAnime(search: string): Promise<AniListMedia[]> {
  const data = await gql<{ Page: { media: AniListMedia[] } }>(SEARCH_QUERY, { search });
  return data.Page.media;
}

export async function fetchAiringSchedule(
  mediaIds: number[],
  fromTimestamp: number,
  toTimestamp: number
): Promise<AiringSchedule[]> {
  if (mediaIds.length === 0) return [];
  const data = await gql<{ Page: { airingSchedules: AiringSchedule[] } }>(AIRING_QUERY, {
    mediaIds,
    from: fromTimestamp,
    to: toTimestamp,
  });
  return data.Page.airingSchedules;
}

export async function fetchWeeklyAiring(
  fromTimestamp: number,
  toTimestamp: number,
  page: number = 1
): Promise<{ schedules: AiringSchedule[]; hasNextPage: boolean }> {
  const data = await gql<{
    Page: {
      pageInfo: { hasNextPage: boolean };
      airingSchedules: AiringSchedule[];
    };
  }>(WEEKLY_AIRING_QUERY, { from: fromTimestamp, to: toTimestamp, page });
  return {
    schedules: data.Page.airingSchedules,
    hasNextPage: data.Page.pageInfo.hasNextPage,
  };
}

export async function fetchAnimeDetail(id: number): Promise<AnimeDetail> {
  const data = await gql<{ Media: AnimeDetail }>(ANIME_DETAIL_QUERY, { id });
  return data.Media;
}

export function mediaToWatchlistEntry(media: AniListMedia) {
  return {
    media_id: media.id,
    id_mal: media.idMal,
    title_romaji: media.title.romaji,
    title_english: media.title.english,
    cover_url: media.coverImage?.medium || '',
    status: media.status,
    total_episodes: media.episodes,
    next_airing_episode: media.nextAiringEpisode?.episode ?? null,
    next_airing_at: media.nextAiringEpisode?.airingAt ?? null,
    watch_status: 'Watching',
  };
}
