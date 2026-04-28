import type { AniListMedia } from '@/lib/types';

vi.mock('@/lib/providers/anilist', () => ({
  searchAnilist: vi.fn(),
  fetchAnilistDetail: vi.fn(),
  fetchAnilistWeeklyAiring: vi.fn(),
  fetchAnilistRecommendations: vi.fn(),
  fetchAnilistViewer: vi.fn(),
  fetchAnilistUserList: vi.fn(),
  fetchAnilistAiringSchedule: vi.fn(),
  ANILIST_STATUS_MAP: {},
}));

vi.mock('@/lib/providers/jikan', () => ({
  searchJikan: vi.fn(),
  fetchJikanDetail: vi.fn(),
}));

vi.mock('@/lib/providers/kitsu', () => ({
  searchKitsu: vi.fn(),
  fetchKitsuDetail: vi.fn(),
}));

vi.mock('@/lib/providers/cache', () => ({
  getCachedAnime: vi.fn().mockResolvedValue(null),
  getCachedSearch: vi.fn().mockResolvedValue([]),
  saveAnimeToCache: vi.fn().mockResolvedValue(undefined),
  saveMultipleToCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/providers/airing-cache', () => ({
  getCachedAiring: vi.fn().mockResolvedValue(null),
  saveAiringToCache: vi.fn().mockResolvedValue(undefined),
}));

import { searchAnime, fetchAnimeDetail, getErrorMessage, mediaToWatchlistEntry } from '@/lib/anime-provider';
import { searchAnilist, fetchAnilistDetail } from '@/lib/providers/anilist';
import { searchJikan, fetchJikanDetail } from '@/lib/providers/jikan';
import { searchKitsu } from '@/lib/providers/kitsu';
import { getCachedSearch, getCachedAnime } from '@/lib/providers/cache';

const testMedia: AniListMedia = {
  id: 1,
  idMal: 100,
  title: { romaji: 'Test Anime', english: 'Test Anime EN' },
  coverImage: { extraLarge: 'xl.jpg', large: 'l.jpg', medium: 'm.jpg' },
  status: 'RELEASING',
  episodes: 12,
  isAdult: false,
  nextAiringEpisode: { airingAt: 1700000000, episode: 5 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getErrorMessage', () => {
  it('returns rate limit message for rate limit errors', () => {
    expect(getErrorMessage(new Error('Rate limited by AniList'))).toBe(
      'Too many requests — please wait a moment and try again'
    );
  });

  it('returns error message for generic errors', () => {
    expect(getErrorMessage(new Error('Network failed'))).toBe('Network failed');
  });

  it('returns fallback for non-Error', () => {
    expect(getErrorMessage('string error')).toBe('Something went wrong');
  });
});

describe('mediaToWatchlistEntry', () => {
  it('maps all fields correctly', () => {
    const entry = mediaToWatchlistEntry(testMedia);
    expect(entry.media_id).toBe(1);
    expect(entry.id_mal).toBe(100);
    expect(entry.title_romaji).toBe('Test Anime');
    expect(entry.title_english).toBe('Test Anime EN');
    expect(entry.cover_url).toBe('xl.jpg');
    expect(entry.status).toBe('RELEASING');
    expect(entry.total_episodes).toBe(12);
    expect(entry.next_airing_episode).toBe(5);
    expect(entry.next_airing_at).toBe(1700000000);
    expect(entry.watch_status).toBe('Watching');
    expect(entry.is_adult).toBe(false);
  });

  it('handles null optional fields', () => {
    const entry = mediaToWatchlistEntry({
      ...testMedia,
      idMal: null,
      nextAiringEpisode: null,
    });
    expect(entry.id_mal).toBeNull();
    expect(entry.next_airing_episode).toBeNull();
    expect(entry.next_airing_at).toBeNull();
  });
});

describe('searchAnime fallback', () => {
  it('returns cached results if available', async () => {
    (getCachedSearch as ReturnType<typeof vi.fn>).mockResolvedValueOnce([testMedia]);
    const results = await searchAnime('test');
    expect(results).toEqual([testMedia]);
    expect(searchAnilist).not.toHaveBeenCalled();
  });

  it('falls back from AniList to Jikan on failure', async () => {
    (searchAnilist as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('AniList down'));
    (searchJikan as ReturnType<typeof vi.fn>).mockResolvedValueOnce([testMedia]);
    const results = await searchAnime('test');
    expect(results).toEqual([testMedia]);
    expect(searchAnilist).toHaveBeenCalled();
    expect(searchJikan).toHaveBeenCalled();
  });

  it('falls back from Jikan to Kitsu on failure', async () => {
    (searchAnilist as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchJikan as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchKitsu as ReturnType<typeof vi.fn>).mockResolvedValueOnce([testMedia]);
    const results = await searchAnime('test');
    expect(results).toEqual([testMedia]);
    expect(searchKitsu).toHaveBeenCalled();
  });

  it('throws when all providers fail', async () => {
    (searchAnilist as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchJikan as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchKitsu as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('all down'));
    await expect(searchAnime('test')).rejects.toThrow('all down');
  });
});

describe('fetchAnimeDetail fallback', () => {
  const testDetail = {
    ...testMedia,
    title: { ...testMedia.title, native: null },
    bannerImage: null,
    description: 'Test desc',
    duration: 24,
    season: 'FALL',
    seasonYear: 2024,
    genres: ['Action'],
    averageScore: 85,
    studios: { nodes: [{ name: 'Studio' }] },
    nextAiringEpisode: { airingAt: 1700000000, episode: 5, timeUntilAiring: 3600 },
    relations: { edges: [] },
  };

  it('returns cached detail if not stale', async () => {
    (getCachedAnime as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      detail: testDetail,
      stale: false,
    });
    const result = await fetchAnimeDetail(1);
    expect(result).toEqual(testDetail);
    expect(fetchAnilistDetail).not.toHaveBeenCalled();
  });

  it('fetches from AniList if cache is stale', async () => {
    (getCachedAnime as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      detail: testDetail,
      stale: true,
    });
    (fetchAnilistDetail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(testDetail);
    const result = await fetchAnimeDetail(1);
    expect(result).toEqual(testDetail);
    expect(fetchAnilistDetail).toHaveBeenCalled();
  });

  it('falls back to Jikan when AniList fails and cache has malId', async () => {
    (getCachedAnime as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      detail: { ...testDetail, idMal: 100 },
      stale: true,
    });
    (fetchAnilistDetail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('down'));
    (fetchJikanDetail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(testDetail);
    const result = await fetchAnimeDetail(1);
    expect(result).toEqual(testDetail);
    expect(fetchJikanDetail).toHaveBeenCalledWith(100);
  });
});
