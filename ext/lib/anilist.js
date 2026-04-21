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

const USER_LIST_QUERY = `
query UserList($userId: Int) {
  MediaListCollection(userId: $userId, type: ANIME, status_in: [CURRENT, PLANNING]) {
    lists {
      entries {
        media {
          id
          idMal
          title { romaji english }
          coverImage { medium }
          status
          episodes
          nextAiringEpisode { airingAt episode }
        }
        progress
      }
    }
  }
}`;

const VIEWER_QUERY = `query { Viewer { id } }`;

async function gql(query, variables, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(ANILIST_API, {
    method: 'POST',
    headers,
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

export async function searchAnime(search) {
  const data = await gql(SEARCH_QUERY, { search });
  return data.Page.media;
}

export async function fetchAiringSchedule(mediaIds, fromTimestamp, toTimestamp) {
  if (mediaIds.length === 0) return [];
  const data = await gql(AIRING_QUERY, {
    mediaIds,
    from: fromTimestamp,
    to: toTimestamp,
  });
  return data.Page.airingSchedules;
}

export async function fetchViewer(token) {
  const data = await gql(VIEWER_QUERY, {}, token);
  return data.Viewer;
}

export async function fetchUserList(userId, token) {
  const data = await gql(USER_LIST_QUERY, { userId }, token);
  const entries = [];
  for (const list of data.MediaListCollection.lists) {
    for (const entry of list.entries) {
      entries.push({
        media: entry.media,
        progress: entry.progress,
      });
    }
  }
  return entries;
}

export function mediaToWatchlistEntry(media, progress = 0) {
  const watched = [];
  for (let i = 1; i <= progress; i++) watched.push(i);

  return {
    mediaId: media.id,
    idMal: media.idMal,
    title: {
      romaji: media.title.romaji,
      english: media.title.english,
    },
    coverUrl: media.coverImage?.medium || '',
    status: media.status,
    totalEpisodes: media.episodes,
    nextAiringEpisode: media.nextAiringEpisode || null,
    episodesWatched: watched,
    addedAt: Math.floor(Date.now() / 1000),
  };
}
