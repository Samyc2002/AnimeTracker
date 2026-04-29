import { searchAnime as searchAnilist, fetchAiringSchedule as fetchAnilistAiring, fetchViewer as fetchAnilistViewer, fetchUserList as fetchAnilistUserList, mediaToWatchlistEntry } from './anilist.js';
import { searchJikan, fetchJikanAiring } from './jikan.js';
import { searchKitsu } from './kitsu.js';
import { listDocuments } from './appwrite-client.js';
import { getAuth } from './auth.js';
import { ANIME_CACHE_COLLECTION_ID, DATABASE_ID } from './config.js';

async function tryProviders(label, ...attempts) {
  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
      console.log(`[Anime Tracker] ${label} provider failed:`, err.message);
    }
  }
  throw lastError || new Error(`All providers failed for ${label}`);
}

async function searchCache(query) {
  try {
    const auth = await getAuth();
    if (!auth?.jwt) return [];
    const res = await listDocuments(auth.jwt, DATABASE_ID, ANIME_CACHE_COLLECTION_ID, [
      `search("title_romaji", "${query}")`,
      'limit(10)',
    ]);
    return (res.documents || []).map(doc => ({
      id: doc.anilist_id || doc.mal_id || 0,
      idMal: doc.mal_id || null,
      title: { romaji: doc.title_romaji || '', english: doc.title_english || null },
      coverImage: { medium: doc.cover_medium || doc.cover_small || '' },
      status: doc.status || 'FINISHED',
      episodes: doc.episodes || null,
      nextAiringEpisode: doc.next_airing_episode && doc.next_airing_at
        ? { episode: doc.next_airing_episode, airingAt: doc.next_airing_at }
        : null,
    }));
  } catch {
    return [];
  }
}

export async function searchAnime(search) {
  const cached = await searchCache(search);
  if (cached.length >= 3) return cached;

  try {
    return await tryProviders(
      'search',
      () => searchAnilist(search),
      () => searchJikan(search),
      () => searchKitsu(search),
    );
  } catch {
    if (cached.length > 0) return cached;
    return [];
  }
}

export async function fetchAiringSchedule(mediaIds, fromTimestamp, toTimestamp) {
  if (mediaIds.length === 0) return [];
  return tryProviders(
    'airing',
    () => fetchAnilistAiring(mediaIds, fromTimestamp, toTimestamp),
    () => fetchJikanAiring(mediaIds, fromTimestamp, toTimestamp),
  );
}

export async function fetchViewer(token) {
  return fetchAnilistViewer(token);
}

export async function fetchUserList(userId, token) {
  return fetchAnilistUserList(userId, token);
}

export { mediaToWatchlistEntry } from './anilist.js';
