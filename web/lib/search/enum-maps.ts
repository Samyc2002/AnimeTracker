// AniList uses its own enums directly — canonical values match
export const ANILIST_FORMAT_MAP: Record<string, string> = {
  TV: 'TV',
  MOVIE: 'MOVIE',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'SPECIAL',
  MUSIC: 'MUSIC',
};

export const ANILIST_STATUS_MAP: Record<string, string> = {
  FINISHED: 'FINISHED',
  RELEASING: 'RELEASING',
  NOT_YET_RELEASED: 'NOT_YET_RELEASED',
  CANCELLED: 'CANCELLED',
};

// Jikan uses MAL's string-based type parameter
export const JIKAN_FORMAT_MAP: Record<string, string> = {
  TV: 'tv',
  MOVIE: 'movie',
  OVA: 'ova',
  ONA: 'ona',
  SPECIAL: 'special',
  MUSIC: 'music',
};

// Jikan status query parameter values
export const JIKAN_STATUS_MAP: Record<string, string> = {
  FINISHED: 'complete',
  RELEASING: 'airing',
  NOT_YET_RELEASED: 'upcoming',
  CANCELLED: 'complete', // MAL has no cancelled — closest is complete
};

// Kitsu uses lowercase subtype for format
export const KITSU_FORMAT_MAP: Record<string, string> = {
  TV: 'TV',
  MOVIE: 'movie',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'special',
  MUSIC: 'music',
};

// Kitsu status filter values
export const KITSU_STATUS_MAP: Record<string, string> = {
  FINISHED: 'finished',
  RELEASING: 'current',
  NOT_YET_RELEASED: 'upcoming',
  CANCELLED: 'finished', // Kitsu has no cancelled
};
