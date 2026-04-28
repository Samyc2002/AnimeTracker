import { Query, ID } from 'appwrite';
import { databases, DATABASE_ID, ANIME_CACHE_COLLECTION_ID } from '@/lib/appwrite';
import type { AniListMedia, AnimeDetail } from '@/lib/types';

const STALE_MS = 24 * 60 * 60 * 1000;

interface CacheDoc {
  $id: string;
  anilist_id: number | null;
  mal_id: number | null;
  kitsu_id: string | null;
  title_romaji: string;
  title_english: string | null;
  title_native: string | null;
  cover_small: string | null;
  cover_medium: string | null;
  cover_large: string | null;
  banner_image: string | null;
  description: string | null;
  status: string;
  episodes: number | null;
  duration: number | null;
  season: string | null;
  season_year: number | null;
  genres: string | null;
  is_adult: boolean;
  average_score: number | null;
  studio: string | null;
  next_airing_episode: number | null;
  next_airing_at: number | null;
  relations_json: string | null;
  updated_at: string;
}

function docToDetail(doc: CacheDoc): AnimeDetail {
  let relations: AnimeDetail['relations'] = { edges: [] };
  try {
    if (doc.relations_json) relations = JSON.parse(doc.relations_json);
  } catch { /* ignore */ }

  return {
    id: doc.anilist_id || doc.mal_id || 0,
    idMal: doc.mal_id,
    title: {
      romaji: doc.title_romaji,
      english: doc.title_english,
      native: doc.title_native,
    },
    coverImage: {
      extraLarge: doc.cover_large || doc.cover_medium || '',
      large: doc.cover_medium || doc.cover_large || '',
      medium: doc.cover_small || doc.cover_medium || '',
    },
    bannerImage: doc.banner_image,
    description: doc.description,
    status: (doc.status as AnimeDetail['status']) || 'FINISHED',
    episodes: doc.episodes,
    duration: doc.duration,
    season: doc.season,
    seasonYear: doc.season_year,
    genres: doc.genres ? doc.genres.split(',').map(g => g.trim()) : [],
    isAdult: doc.is_adult,
    averageScore: doc.average_score,
    studios: { nodes: doc.studio ? [{ name: doc.studio }] : [] },
    nextAiringEpisode: doc.next_airing_episode && doc.next_airing_at
      ? { airingAt: doc.next_airing_at, episode: doc.next_airing_episode, timeUntilAiring: Math.max(0, doc.next_airing_at - Math.floor(Date.now() / 1000)) }
      : null,
    relations,
  };
}

function docToMedia(doc: CacheDoc): AniListMedia {
  return {
    id: doc.anilist_id || doc.mal_id || 0,
    idMal: doc.mal_id,
    title: { romaji: doc.title_romaji, english: doc.title_english },
    coverImage: {
      extraLarge: doc.cover_large || doc.cover_medium || '',
      large: doc.cover_medium || doc.cover_large || '',
      medium: doc.cover_small || doc.cover_medium || '',
    },
    status: (doc.status as AniListMedia['status']) || 'FINISHED',
    episodes: doc.episodes,
    isAdult: doc.is_adult,
    nextAiringEpisode: doc.next_airing_episode && doc.next_airing_at
      ? { airingAt: doc.next_airing_at, episode: doc.next_airing_episode }
      : null,
  };
}

function detailToDoc(anime: AnimeDetail): Record<string, unknown> {
  return {
    anilist_id: anime.id || null,
    mal_id: anime.idMal || null,
    kitsu_id: null,
    title_romaji: anime.title.romaji || 'Unknown',
    title_english: anime.title.english || null,
    title_native: anime.title.native || null,
    cover_small: anime.coverImage.medium || null,
    cover_medium: anime.coverImage.large || null,
    cover_large: anime.coverImage.extraLarge || null,
    banner_image: anime.bannerImage || null,
    description: anime.description || null,
    status: anime.status || 'FINISHED',
    episodes: anime.episodes || null,
    duration: anime.duration || null,
    season: anime.season || null,
    season_year: anime.seasonYear || null,
    genres: anime.genres?.join(', ') || null,
    is_adult: anime.isAdult ?? false,
    average_score: anime.averageScore || null,
    studio: anime.studios?.nodes?.[0]?.name || null,
    next_airing_episode: anime.nextAiringEpisode?.episode || null,
    next_airing_at: anime.nextAiringEpisode?.airingAt || null,
    relations_json: anime.relations ? JSON.stringify(anime.relations) : null,
    updated_at: new Date().toISOString(),
  };
}

function isStale(doc: CacheDoc): boolean {
  return Date.now() - new Date(doc.updated_at).getTime() > STALE_MS;
}

export async function getCachedAnime(opts: {
  anilistId?: number;
  malId?: number;
  title?: string;
}): Promise<{ detail: AnimeDetail; stale: boolean } | null> {
  try {
    const queries = [];
    if (opts.anilistId) {
      queries.push(Query.equal('anilist_id', opts.anilistId));
    } else if (opts.malId) {
      queries.push(Query.equal('mal_id', opts.malId));
    } else if (opts.title) {
      queries.push(Query.equal('title_romaji', opts.title));
    } else {
      return null;
    }
    queries.push(Query.limit(1));

    const res = await databases.listDocuments(DATABASE_ID, ANIME_CACHE_COLLECTION_ID, queries);
    if (res.documents.length === 0) return null;

    const doc = res.documents[0] as unknown as CacheDoc;
    return { detail: docToDetail(doc), stale: isStale(doc) };
  } catch (err) {
    console.error('[AnimeCache] Read failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getCachedSearch(query: string): Promise<AniListMedia[]> {
  try {
    const res = await databases.listDocuments(DATABASE_ID, ANIME_CACHE_COLLECTION_ID, [
      Query.search('title_romaji', query),
      Query.limit(10),
    ]);
    return res.documents.map(d => docToMedia(d as unknown as CacheDoc));
  } catch {
    return [];
  }
}

export async function saveAnimeToCache(anime: AnimeDetail): Promise<void> {
  try {
    const data = detailToDoc(anime);

    const existingQueries = [];
    if (anime.id) existingQueries.push(Query.equal('anilist_id', anime.id));
    else if (anime.idMal) existingQueries.push(Query.equal('mal_id', anime.idMal));

    if (existingQueries.length > 0) {
      existingQueries.push(Query.limit(1));
      const existing = await databases.listDocuments(DATABASE_ID, ANIME_CACHE_COLLECTION_ID, existingQueries);
      if (existing.documents.length > 0) {
        await databases.updateDocument(DATABASE_ID, ANIME_CACHE_COLLECTION_ID, existing.documents[0].$id, data);
        return;
      }
    }

    await databases.createDocument(DATABASE_ID, ANIME_CACHE_COLLECTION_ID, ID.unique(), data);
  } catch (err) {
    console.error('[AnimeCache] Write failed:', err instanceof Error ? err.message : err);
  }
}

export async function saveMultipleToCache(animeList: AnimeDetail[]): Promise<void> {
  for (const anime of animeList) {
    await saveAnimeToCache(anime);
  }
}
