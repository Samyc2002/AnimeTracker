export interface GenreMapping {
  anilist: string;
  malId: number | null;
  kitsuSlug: string | null;
}

export const GENRE_MAP: GenreMapping[] = [
  { anilist: 'Action',        malId: 1,  kitsuSlug: 'action' },
  { anilist: 'Adventure',     malId: 2,  kitsuSlug: 'adventure' },
  { anilist: 'Comedy',        malId: 4,  kitsuSlug: 'comedy' },
  { anilist: 'Drama',         malId: 8,  kitsuSlug: 'drama' },
  { anilist: 'Ecchi',         malId: 9,  kitsuSlug: 'ecchi' },
  { anilist: 'Fantasy',       malId: 10, kitsuSlug: 'fantasy' },
  { anilist: 'Hentai',        malId: 12, kitsuSlug: 'hentai' },
  { anilist: 'Horror',        malId: 14, kitsuSlug: 'horror' },
  { anilist: 'Mahou Shoujo',  malId: 66, kitsuSlug: null },
  { anilist: 'Mecha',         malId: 18, kitsuSlug: 'mecha' },
  { anilist: 'Music',         malId: 19, kitsuSlug: 'music' },
  { anilist: 'Mystery',       malId: 7,  kitsuSlug: 'mystery' },
  { anilist: 'Psychological', malId: 40, kitsuSlug: null },
  { anilist: 'Romance',       malId: 22, kitsuSlug: 'romance' },
  { anilist: 'Sci-Fi',        malId: 24, kitsuSlug: 'sci-fi' },
  { anilist: 'Slice of Life', malId: 36, kitsuSlug: 'slice-of-life' },
  { anilist: 'Sports',        malId: 30, kitsuSlug: 'sports' },
  { anilist: 'Supernatural',  malId: 37, kitsuSlug: 'supernatural' },
  { anilist: 'Thriller',      malId: 41, kitsuSlug: null },
];

export function getMalId(anilistGenre: string): number | null {
  return GENRE_MAP.find((g) => g.anilist === anilistGenre)?.malId ?? null;
}

export function getKitsuSlug(anilistGenre: string): string | null {
  return GENRE_MAP.find((g) => g.anilist === anilistGenre)?.kitsuSlug ?? null;
}
