import type { AniListMedia } from '@/lib/types';

vi.mock('@/lib/providers/anilist', () => ({
  searchAnilist: vi.fn(),
  searchAnilistPaginated: vi.fn(),
  fetchAnilistDetail: vi.fn(),
  fetchAnilistWeeklyAiring: vi.fn(),
  fetchAnilistRecommendations: vi.fn(),
  fetchAnilistViewer: vi.fn(),
  fetchAnilistUserList: vi.fn(),
  fetchAnilistAiringSchedule: vi.fn(),
  searchAnilistFiltered: vi.fn(),
  ANILIST_STATUS_MAP: {},
}));

vi.mock('@/lib/providers/jikan', () => ({
  searchJikan: vi.fn(),
  searchJikanPaginated: vi.fn(),
  fetchJikanDetail: vi.fn(),
  fetchJikanSchedule: vi.fn(),
}));

vi.mock('@/lib/providers/kitsu', () => ({
  searchKitsu: vi.fn(),
  searchKitsuPaginated: vi.fn(),
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

import { searchAnime, searchAnimePaginated, fetchAnimeDetail, fetchWeeklyAiring, fetchRecommendations, searchAnimeFiltered, getErrorMessage, mediaToWatchlistEntry } from '@/lib/anime-provider';
import { searchAnilist, searchAnilistPaginated, fetchAnilistDetail, fetchAnilistWeeklyAiring, fetchAnilistRecommendations, searchAnilistFiltered } from '@/lib/providers/anilist';
import { searchJikan, searchJikanPaginated, fetchJikanDetail } from '@/lib/providers/jikan';
import { searchKitsu, searchKitsuPaginated } from '@/lib/providers/kitsu';
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
      'Too many requests. Please wait a moment and try again.'
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
  it('uses cache as fallback when all providers fail', async () => {
    const cachedResults = [testMedia, { ...testMedia, id: 2 }, { ...testMedia, id: 3 }];
    (searchAnilist as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchJikan as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchKitsu as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (getCachedSearch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(cachedResults);
    const results = await searchAnime('test');
    expect(results).toEqual(cachedResults);
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

  it('throws when all providers and cache fail', async () => {
    (searchAnilist as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchJikan as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchKitsu as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('all down'));
    (getCachedSearch as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    await expect(searchAnime('test')).rejects.toThrow('Search failed across all providers');
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

  it('returns cached detail if not stale and complete', async () => {
    (getCachedAnime as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      detail: testDetail,
      stale: false,
      complete: true,
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

  it('falls back to Jikan title search when Jikan ID lookup fails', async () => {
    (getCachedAnime as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      detail: { ...testDetail, idMal: 100, title: { romaji: 'Test Anime', english: null, native: null } },
      stale: true,
    });
    (fetchAnilistDetail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('down'));
    (fetchJikanDetail as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce(testDetail);
    (searchJikan as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ ...testMedia, idMal: 200 }]);
    const result = await fetchAnimeDetail(1);
    expect(result).toEqual(testDetail);
    expect(searchJikan).toHaveBeenCalledWith('Test Anime');
    expect(fetchJikanDetail).toHaveBeenCalledWith(200);
  });

  it('falls back to Kitsu when AniList and Jikan both fail', async () => {
    const { fetchKitsuDetail } = await import('@/lib/providers/kitsu');
    (getCachedAnime as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      detail: { ...testDetail, title: { romaji: 'Test Anime', english: null, native: null } },
      stale: true,
    });
    (fetchAnilistDetail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('down'));
    (fetchJikanDetail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('down'));
    (searchJikan as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (searchKitsu as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ ...testMedia, id: 55 }]);
    (fetchKitsuDetail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(testDetail);
    const result = await fetchAnimeDetail(1);
    expect(result).toEqual(testDetail);
  });
});

describe('fetchWeeklyAiring', () => {
  it('returns AniList data on success', async () => {
    (fetchAnilistWeeklyAiring as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ schedules: [], hasNextPage: false });
    const result = await fetchWeeklyAiring(0, 1000);
    expect(result).toEqual({ schedules: [], hasNextPage: false });
  });

  it('returns empty for page > 1 when AniList fails', async () => {
    (fetchAnilistWeeklyAiring as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    const result = await fetchWeeklyAiring(0, 1000, 2);
    expect(result).toEqual({ schedules: [], hasNextPage: false });
  });
});

describe('fetchRecommendations', () => {
  it('returns AniList recommendations on success', async () => {
    const data = { trending: [testMedia], popular: [testMedia] };
    (fetchAnilistRecommendations as ReturnType<typeof vi.fn>).mockResolvedValueOnce(data);
    const result = await fetchRecommendations();
    expect(result).toEqual(data);
  });

  it('returns empty on total failure', async () => {
    (fetchAnilistRecommendations as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network')));
    const result = await fetchRecommendations();
    expect(result).toEqual({ trending: [], popular: [] });
  });
});

describe('searchAnimeFiltered', () => {
  it('filters out excluded media IDs', async () => {
    (searchAnilistFiltered as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      media: [testMedia, { ...testMedia, id: 2 }, { ...testMedia, id: 3 }],
      hasNextPage: false,
    });
    const result = await searchAnimeFiltered({
      genres: ['Action'],
      status: null,
      minScore: 60,
      maxEpisodes: null,
      sort: 'SCORE_DESC',
      excludeMediaIds: [1, 3],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters by maxEpisodes', async () => {
    (searchAnilistFiltered as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      media: [
        { ...testMedia, id: 1, episodes: 12 },
        { ...testMedia, id: 2, episodes: 50 },
        { ...testMedia, id: 3, episodes: null },
      ],
      hasNextPage: false,
    });
    const result = await searchAnimeFiltered({
      genres: ['Action'],
      status: null,
      minScore: 60,
      maxEpisodes: 13,
      sort: 'SCORE_DESC',
      excludeMediaIds: [],
    });
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual([1, 3]);
  });

  it('falls back to unfiltered search when genres return no results', async () => {
    (searchAnilistFiltered as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ media: [], hasNextPage: false })
      .mockResolvedValueOnce({ media: [testMedia], hasNextPage: false });
    const result = await searchAnimeFiltered({
      genres: ['Obscure'],
      status: null,
      minScore: 60,
      maxEpisodes: null,
      sort: 'SCORE_DESC',
      excludeMediaIds: [],
    });
    expect(result).toHaveLength(1);
    expect(searchAnilistFiltered).toHaveBeenCalledTimes(2);
  });
});

describe('searchAnimePaginated', () => {
  const paginatedResult = { results: [testMedia], hasNextPage: true };

  it('returns results and hasNextPage from AniList', async () => {
    (searchAnilistPaginated as ReturnType<typeof vi.fn>).mockResolvedValueOnce(paginatedResult);
    const result = await searchAnimePaginated('test', 1);
    expect(result).toEqual(paginatedResult);
    expect(searchAnilistPaginated).toHaveBeenCalledWith('test', 1, 15);
  });

  it('passes page number to provider', async () => {
    (searchAnilistPaginated as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ results: [testMedia], hasNextPage: false });
    await searchAnimePaginated('test', 3);
    expect(searchAnilistPaginated).toHaveBeenCalledWith('test', 3, 15);
  });

  it('falls back from AniList to Jikan on failure', async () => {
    (searchAnilistPaginated as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchJikanPaginated as ReturnType<typeof vi.fn>).mockResolvedValueOnce(paginatedResult);
    const result = await searchAnimePaginated('test', 1);
    expect(result).toEqual(paginatedResult);
    expect(searchJikanPaginated).toHaveBeenCalledWith('test', 1, 15);
  });

  it('uses cache fallback only for page 1', async () => {
    const cachedResults = [testMedia];
    (searchAnilistPaginated as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchJikanPaginated as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchKitsuPaginated as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (getCachedSearch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(cachedResults);
    const result = await searchAnimePaginated('test', 1);
    expect(result).toEqual({ results: cachedResults, hasNextPage: false });
  });

  it('throws for page 2+ when all providers fail (no cache fallback)', async () => {
    (searchAnilistPaginated as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchJikanPaginated as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    (searchKitsuPaginated as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    await expect(searchAnimePaginated('test', 2)).rejects.toThrow('Search failed across all providers');
    expect(getCachedSearch).not.toHaveBeenCalled();
  });
});
