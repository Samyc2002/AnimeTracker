import type { AniListMedia, AnimeDetail } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMedia(overrides: Partial<AniListMedia> = {}): AniListMedia {
  return {
    id: 1,
    idMal: 100,
    title: { romaji: 'Test Anime', english: 'Test EN' },
    coverImage: { extraLarge: '', large: '', medium: '' },
    status: 'FINISHED',
    episodes: 12,
    isAdult: false,
    nextAiringEpisode: null,
    genres: ['Action', 'Adventure'],
    tags: [{ name: 'Shounen', rank: 90 }],
    studios: { nodes: [{ name: 'MAPPA' }] },
    format: 'TV',
    season: 'FALL',
    seasonYear: 2023,
    source: 'MANGA',
    duration: 24,
    averageScore: 85,
    popularity: 1500,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<AnimeDetail> = {}): AnimeDetail {
  return {
    id: 2,
    idMal: 200,
    title: { romaji: 'Detail Anime', english: 'Detail EN', native: null },
    coverImage: { extraLarge: '', large: '', medium: '' },
    bannerImage: null,
    description: null,
    status: 'FINISHED',
    episodes: 24,
    duration: 23,
    season: 'SPRING',
    seasonYear: 2021,
    genres: ['Drama', 'Romance'],
    tags: [{ name: 'School', rank: 80 }],
    isAdult: false,
    format: 'TV',
    source: 'ORIGINAL',
    averageScore: 90,
    popularity: 2000,
    studios: { nodes: [{ name: 'KyoAni' }] },
    nextAiringEpisode: null,
    relations: { edges: [] },
    ...overrides,
  };
}

function makeSupabase() {
  const upsertFn = vi.fn().mockReturnValue(Promise.resolve({ error: null }));
  const fromResult = { upsert: upsertFn };
  return {
    from: vi.fn(() => fromResult),
    _upsert: upsertFn,
  };
}

// ─── upsertSeriesMetadata ─────────────────────────────────────────────────────

describe('upsertSeriesMetadata', () => {
  beforeEach(() => vi.resetModules());

  it('upserts correct row from AniListMedia with metadata', async () => {
    const { upsertSeriesMetadata } = await import('@/lib/series-metadata');
    const sb = makeSupabase();
    const media = makeMedia();

    await upsertSeriesMetadata(sb as never, media);

    expect(sb.from).toHaveBeenCalledWith('series_metadata');
    expect(sb._upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        anilist_id: 1,
        genres: ['Action', 'Adventure'],
        tags: [{ name: 'Shounen', rank: 90 }],
        studio: 'MAPPA',
        format: 'TV',
        season: 'FALL',
        season_year: 2023,
        source: 'MANGA',
        episode_count: 12,
        duration: 24,
        average_score: 85,
        popularity: 1500,
      }),
      { onConflict: 'anilist_id' },
    );
  });

  it('upserts correct row from AnimeDetail', async () => {
    const { upsertSeriesMetadata } = await import('@/lib/series-metadata');
    const sb = makeSupabase();
    const detail = makeDetail();

    await upsertSeriesMetadata(sb as never, detail);

    expect(sb._upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        anilist_id: 2,
        genres: ['Drama', 'Romance'],
        studio: 'KyoAni',
        season_year: 2021,
        average_score: 90,
      }),
      { onConflict: 'anilist_id' },
    );
  });

  it('no-ops when media has no useful metadata fields', async () => {
    const { upsertSeriesMetadata } = await import('@/lib/series-metadata');
    const sb = makeSupabase();
    const media = makeMedia({
      genres: undefined,
      studios: undefined,
      format: undefined,
      seasonYear: undefined,
      averageScore: undefined,
    });

    await upsertSeriesMetadata(sb as never, media);

    expect(sb.from).not.toHaveBeenCalled();
  });

  it('no-ops when media id is 0', async () => {
    const { upsertSeriesMetadata } = await import('@/lib/series-metadata');
    const sb = makeSupabase();
    await upsertSeriesMetadata(sb as never, makeMedia({ id: 0 }));
    expect(sb.from).not.toHaveBeenCalled();
  });

});

// ─── upsertSeriesMetadataBatch ────────────────────────────────────────────────

describe('upsertSeriesMetadataBatch', () => {
  beforeEach(() => vi.resetModules());

  it('filters out entries with no useful metadata before writing', async () => {
    const { upsertSeriesMetadataBatch } = await import('@/lib/series-metadata');
    const sb = makeSupabase();

    const empty = makeMedia({ id: 10, genres: undefined, studios: undefined, format: undefined, seasonYear: undefined, averageScore: undefined });
    const full = makeMedia({ id: 11 });

    await upsertSeriesMetadataBatch(sb as never, [empty, full]);

    expect(sb._upsert).toHaveBeenCalledOnce();
    const rows = sb._upsert.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].anilist_id).toBe(11);
  });

  it('no-ops when all entries lack metadata', async () => {
    const { upsertSeriesMetadataBatch } = await import('@/lib/series-metadata');
    const sb = makeSupabase();
    const media = makeMedia({ genres: undefined, studios: undefined, format: undefined, seasonYear: undefined, averageScore: undefined });

    await upsertSeriesMetadataBatch(sb as never, [media]);

    expect(sb.from).not.toHaveBeenCalled();
  });

  it('upserts with onConflict anilist_id', async () => {
    const { upsertSeriesMetadataBatch } = await import('@/lib/series-metadata');
    const sb = makeSupabase();
    await upsertSeriesMetadataBatch(sb as never, [makeMedia()]);
    expect(sb._upsert).toHaveBeenCalledWith(expect.any(Array), { onConflict: 'anilist_id' });
  });
});

// ─── Achievement evaluator: distinct_count ────────────────────────────────────

describe('distinct_count evaluator (series_metadata)', () => {
  function makeEvaluatorSupabase({
    entries = [{ canonical_anilist_id: 1 }, { canonical_anilist_id: 2 }],
    metadata = [] as Record<string, unknown>[],
  } = {}) {
    const metaChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: metadata, error: null }),
    };
    const entriesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: entries, error: null }),
    };

    return {
      from: vi.fn((table: string) => {
        if (table === 'series_metadata') return metaChain;
        return entriesChain;
      }),
    };
  }

  async function getDistinctCount() {
    const { getEvaluator } = await import('@/lib/achievements/evaluators');
    return getEvaluator('distinct_count')!;
  }

  beforeEach(() => vi.resetModules());

  it('completed_anime_genres counts distinct genres from series_metadata', async () => {
    const evaluator = await getDistinctCount();
    const sb = makeEvaluatorSupabase({
      entries: [{ canonical_anilist_id: 1 }, { canonical_anilist_id: 2 }],
      metadata: [
        { genres: ['Action', 'Drama'] },
        { genres: ['Action', 'Comedy'] },
      ],
    });

    const result = await evaluator('user1', { source: 'completed_anime_genres', threshold: 10 }, sb as never);
    // 3 distinct: Action, Drama, Comedy
    expect(result.progress).toBe(3);
    expect(result.target).toBe(10);
  });

  it('completed_anime_studios counts distinct studios from series_metadata', async () => {
    const evaluator = await getDistinctCount();
    const sb = makeEvaluatorSupabase({
      metadata: [{ studio: 'MAPPA' }, { studio: 'KyoAni' }, { studio: 'MAPPA' }],
    });

    const result = await evaluator('user1', { source: 'completed_anime_studios', threshold: 10 }, sb as never);
    expect(result.progress).toBe(2);
  });

  it('completed_anime_decades counts distinct decades from series_metadata', async () => {
    const evaluator = await getDistinctCount();
    const sb = makeEvaluatorSupabase({
      metadata: [{ season_year: 2013 }, { season_year: 2018 }, { season_year: 2020 }],
    });

    const result = await evaluator('user1', { source: 'completed_anime_decades', threshold: 10 }, sb as never);
    // 2010s and 2020s = 2 decades
    expect(result.progress).toBe(2);
  });

  it('returns 0 when no entries have canonical_anilist_id', async () => {
    const evaluator = await getDistinctCount();
    const sb = makeEvaluatorSupabase({ entries: [] });

    const result = await evaluator('user1', { source: 'completed_anime_genres', threshold: 5 }, sb as never);
    expect(result.progress).toBe(0);
  });

  it('silently skips entries with no series_metadata row (no crash)', async () => {
    const evaluator = await getDistinctCount();
    const sb = makeEvaluatorSupabase({ entries: [{ canonical_anilist_id: 99 }], metadata: [] });

    const result = await evaluator('user1', { source: 'completed_anime_genres', threshold: 5 }, sb as never);
    expect(result.progress).toBe(0);
  });

  it('caps progress at threshold', async () => {
    const evaluator = await getDistinctCount();
    const sb = makeEvaluatorSupabase({
      metadata: [{ genres: ['Action', 'Drama', 'Comedy', 'Horror', 'Sci-Fi'] }],
    });

    const result = await evaluator('user1', { source: 'completed_anime_genres', threshold: 3 }, sb as never);
    expect(result.progress).toBe(3);
    expect(result.target).toBe(3);
  });
});
