export interface AniListMedia {
  id: number;
  idMal: number | null;
  title: {
    romaji: string;
    english: string | null;
  };
  coverImage: {
    large: string;
    medium: string;
  };
  status: 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
  episodes: number | null;
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
  } | null;
}

export interface AiringSchedule {
  mediaId: number;
  episode: number;
  airingAt: number;
  media?: AniListMedia;
}

export interface AnimeDetail {
  id: number;
  idMal: number | null;
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
  };
  coverImage: {
    large: string;
    medium: string;
  };
  bannerImage: string | null;
  description: string | null;
  status: 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
  genres: string[];
  averageScore: number | null;
  studios: {
    nodes: { name: string }[];
  };
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
    timeUntilAiring: number;
  } | null;
  relations: {
    edges: {
      relationType: string;
      node: {
        id: number;
        title: { romaji: string; english: string | null };
        coverImage: { large: string; medium: string };
        type: string;
        status: string;
      };
    }[];
  };
}

export type WatchStatus = 'Watching' | 'Planned' | 'Completed' | 'Dropped';

export interface WatchlistEntry {
  id?: number;
  user_id?: string;
  media_id: number;
  id_mal: number | null;
  title_romaji: string | null;
  title_english: string | null;
  cover_url: string;
  status: string;
  total_episodes: number | null;
  next_airing_episode: number | null;
  next_airing_at: number | null;
  watch_status?: WatchStatus;
  added_at?: string;
}

export interface WatchedEpisode {
  id?: number;
  user_id?: string;
  media_id: number;
  episode_number: number;
  watched_at?: string;
}
