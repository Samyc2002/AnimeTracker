export interface AniListMedia {
  id: number;
  idMal: number | null;
  title: {
    romaji: string;
    english: string | null;
  };
  coverImage: {
    extraLarge: string;
    large: string;
    medium: string;
  };
  status:
    | "RELEASING"
    | "FINISHED"
    | "NOT_YET_RELEASED"
    | "CANCELLED"
    | "HIATUS";
  episodes: number | null;
  isAdult?: boolean;
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
  } | null;
  // Metadata fields — present when fetched via metadata-enriched queries
  genres?: string[];
  tags?: { name: string; rank: number }[];
  studios?: { nodes: { name: string }[] };
  format?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  source?: string | null;
  duration?: number | null;
  averageScore?: number | null;
  popularity?: number | null;
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
    extraLarge: string;
    large: string;
    medium: string;
  };
  bannerImage: string | null;
  description: string | null;
  status:
    | "RELEASING"
    | "FINISHED"
    | "NOT_YET_RELEASED"
    | "CANCELLED"
    | "HIATUS";
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
  genres: string[];
  tags?: { name: string; rank: number }[];
  isAdult?: boolean;
  averageScore: number | null;
  format?: string | null;
  source?: string | null;
  popularity?: number | null;
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
        coverImage: { extraLarge: string; large: string; medium: string };
        type: string;
        status: string;
        isAdult?: boolean;
      };
    }[];
  };
}

export interface WatchURLs {
  url9anime: string;
  urlKickass: string;
}

export type WatchStatus = "Watching" | "Planned" | "Completed" | "Dropped";

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
  is_adult?: boolean;
  added_at?: string;
}

export interface WatchedEpisode {
  id?: number;
  user_id?: string;
  media_id: number;
  episode_number: number;
  watched_at?: string;
}

export interface PublicProfileEntry {
  media_id: number;
  title_romaji: string | null;
  title_english: string | null;
  cover_url: string;
  status: string;
  total_episodes: number | null;
  watch_status: WatchStatus;
  episodes_watched: number;
  is_nsfw: boolean;
}

export interface PublicProfile {
  username: string;
  display_name: string | null;
  joined_at: string;
  avatar: string | null;
  social_twitter: string | null;
  social_discord: string | null;
  social_instagram: string | null;
  social_reddit: string | null;
  stats: {
    total_anime: number;
    episodes_watched: number;
    watching: number;
    completed: number;
    planned: number;
    dropped: number;
  };
  watchlist: PublicProfileEntry[];
}

// Recommendation types

export interface GenrePreference {
  genre: string;
  count: number;
  percentage: number;
}

export interface StudioPreference {
  studio: string;
  count: number;
}

export interface TasteProfile {
  topGenres: GenrePreference[];
  topStudios: StudioPreference[];
  avgScore: number;
  avgEpisodes: number;
  totalCompleted: number;
  genrePairs: [string, string, number][];
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
}

export interface QuizOption {
  label: string;
  value: string;
}

export interface RecommendationFilters {
  genres: string[];
  status: "RELEASING" | "FINISHED" | null;
  minScore: number;
  maxEpisodes: number | null;
  sort: "SCORE_DESC" | "TRENDING_DESC" | "POPULARITY_DESC";
  excludeMediaIds: number[];
}

// Buddy types

export type BuddyStatus = "pending" | "accepted" | "declined";

export interface BuddyDoc {
  $id: string;
  sender_id: string;
  receiver_id: string;
  status: BuddyStatus;
  created_at: string;
}

export interface BuddyRecommendationDoc {
  $id: string;
  from_user_id: string;
  to_user_id: string;
  media_id: number;
  title: string;
  cover_url: string;
  message: string | null;
  created_at: string;
}

export interface BuddyProfile {
  userId: string;
  username: string;
  displayName: string | null;
}
