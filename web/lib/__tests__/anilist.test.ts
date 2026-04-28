import type { AniListMedia } from '@/lib/types';

const ANILIST_API = 'https://graphql.anilist.co';

function makeFetchResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => data,
  } as Response;
}

function make429Response(retryAfter?: string) {
  const headers = new Headers();
  if (retryAfter) headers.set('Retry-After', retryAfter);
  return {
    ok: false,
    status: 429,
    headers,
    json: async () => ({}),
  } as Response;
}

function makeMedia(overrides: Partial<AniListMedia> = {}): AniListMedia {
  return {
    id: 1,
    idMal: 100,
    title: { romaji: 'Test Anime', english: 'Test Anime EN' },
    coverImage: {
      extraLarge: 'https://img.anilist.co/xl.jpg',
      large: 'https://img.anilist.co/lg.jpg',
      medium: 'https://img.anilist.co/md.jpg',
    },
    status: 'RELEASING',
    episodes: 12,
    isAdult: false,
    nextAiringEpisode: { airingAt: 1700000000, episode: 5 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─── getErrorMessage ─────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('returns rate limit message for errors containing "Rate limited"', async () => {
    const { getErrorMessage } = await import('@/lib/anilist');
    const result = getErrorMessage(new Error('Rate limited by AniList'));
    expect(result).toBe('Too many requests — please wait a moment and try again');
  });

  it('returns the error message for generic Error instances', async () => {
    const { getErrorMessage } = await import('@/lib/anilist');
    expect(getErrorMessage(new Error('Network failed'))).toBe('Network failed');
  });

  it('returns fallback for non-Error values', async () => {
    const { getErrorMessage } = await import('@/lib/anilist');
    expect(getErrorMessage('some string')).toBe('Something went wrong');
    expect(getErrorMessage(42)).toBe('Something went wrong');
    expect(getErrorMessage(null)).toBe('Something went wrong');
  });
});

// ─── mediaToWatchlistEntry ───────────────────────────────────────────

describe('mediaToWatchlistEntry', () => {
  it('maps a complete AniListMedia to a watchlist entry', async () => {
    const { mediaToWatchlistEntry } = await import('@/lib/anilist');
    const media = makeMedia();
    const entry = mediaToWatchlistEntry(media);

    expect(entry).toEqual({
      media_id: 1,
      id_mal: 100,
      title_romaji: 'Test Anime',
      title_english: 'Test Anime EN',
      cover_url: 'https://img.anilist.co/xl.jpg',
      status: 'RELEASING',
      total_episodes: 12,
      next_airing_episode: 5,
      next_airing_at: 1700000000,
      watch_status: 'Watching',
      is_adult: false,
    });
  });

  it('handles null/missing fields gracefully', async () => {
    const { mediaToWatchlistEntry } = await import('@/lib/anilist');
    const media = makeMedia({
      idMal: null,
      episodes: null,
      nextAiringEpisode: null,
      isAdult: undefined,
    });
    const entry = mediaToWatchlistEntry(media);

    expect(entry.id_mal).toBeNull();
    expect(entry.total_episodes).toBeNull();
    expect(entry.next_airing_episode).toBeNull();
    expect(entry.next_airing_at).toBeNull();
    expect(entry.is_adult).toBe(false);
  });
});

// ─── searchAnime ─────────────────────────────────────────────────────

describe('searchAnime', () => {
  it('returns media array on successful response', async () => {
    vi.resetModules();
    const media = [makeMedia()];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ data: { Page: { media } } })),
    );

    const { searchAnime } = await import('@/lib/anilist');
    const result = await searchAnime('naruto');

    expect(result).toEqual(media);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      ANILIST_API,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ─── fetchAnimeDetail ────────────────────────────────────────────────

describe('fetchAnimeDetail', () => {
  it('returns detail on successful response', async () => {
    vi.resetModules();
    const detail = { id: 1, title: { romaji: 'Test' } };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ data: { Media: detail } })),
    );

    const { fetchAnimeDetail } = await import('@/lib/anilist');
    const result = await fetchAnimeDetail(1);
    expect(result).toEqual(detail);
  });

  it('returns cached result on second call within TTL', async () => {
    vi.resetModules();
    vi.useFakeTimers();

    const detail = { id: 1, title: { romaji: 'Cached' } };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ data: { Media: detail } })),
    );

    const { fetchAnimeDetail } = await import('@/lib/anilist');

    await fetchAnimeDetail(1);
    await fetchAnimeDetail(1);

    // fetch should only be called once since the second call is cached
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

// ─── Rate limit retry ────────────────────────────────────────────────

describe('gql rate limit retry', () => {
  it('retries on 429 then succeeds', async () => {
    vi.resetModules();
    vi.useFakeTimers();

    const media = [makeMedia()];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(make429Response('1'))
      .mockResolvedValueOnce(makeFetchResponse({ data: { Page: { media } } }));
    vi.stubGlobal('fetch', fetchMock);

    const { searchAnime } = await import('@/lib/anilist');
    const promise = searchAnime('retry-test');

    // Advance past the retry delay (Retry-After: 1 second)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toEqual(media);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

// ─── GraphQL errors ──────────────────────────────────────────────────

describe('gql GraphQL errors', () => {
  it('throws the first error message from the errors array', async () => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse({
          errors: [{ message: 'Validation failed' }, { message: 'Other error' }],
        }),
      ),
    );

    const { searchAnime } = await import('@/lib/anilist');
    await expect(searchAnime('bad-query')).rejects.toThrow('Validation failed');
  });
});

// ─── Non-200 response ────────────────────────────────────────────────

describe('gql non-200 error', () => {
  it('throws AniList API error with status code', async () => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({}, 500)),
    );

    const { searchAnime } = await import('@/lib/anilist');
    await expect(searchAnime('fail')).rejects.toThrow('AniList API error: 500');
  });
});

// ─── fetchAiringSchedule ─────────────────────────────────────────────

describe('fetchAiringSchedule', () => {
  it('returns empty array for empty mediaIds without fetching', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());

    const { fetchAiringSchedule } = await import('@/lib/anilist');
    const result = await fetchAiringSchedule([], 0, 1000);

    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
