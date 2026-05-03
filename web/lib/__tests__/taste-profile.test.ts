import { describe, it, expect } from 'vitest';
import { buildTasteProfile, generateQuestions, buildFiltersFromAnswers } from '@/lib/taste-profile';

const mockCacheDocs = [
  { genres: 'Action, Adventure, Fantasy', studio: 'MAPPA', average_score: 85, episodes: 24 },
  { genres: 'Action, Drama', studio: 'MAPPA', average_score: 90, episodes: 12 },
  { genres: 'Romance, Comedy, Slice of Life', studio: 'KyoAni', average_score: 80, episodes: 13 },
  { genres: 'Action, Fantasy, Drama', studio: 'ufotable', average_score: 88, episodes: 26 },
  { genres: 'Comedy, Slice of Life', studio: 'KyoAni', average_score: 75, episodes: 12 },
];

describe('buildTasteProfile', () => {
  it('counts genre frequencies correctly', () => {
    const profile = buildTasteProfile(mockCacheDocs);
    const actionGenre = profile.topGenres.find((g) => g.genre === 'Action');
    expect(actionGenre).toBeDefined();
    expect(actionGenre!.count).toBe(3);
  });

  it('sorts genres by frequency descending', () => {
    const profile = buildTasteProfile(mockCacheDocs);
    for (let i = 1; i < profile.topGenres.length; i++) {
      expect(profile.topGenres[i - 1].count).toBeGreaterThanOrEqual(profile.topGenres[i].count);
    }
  });

  it('computes average score', () => {
    const profile = buildTasteProfile(mockCacheDocs);
    expect(profile.avgScore).toBe(Math.round((85 + 90 + 80 + 88 + 75) / 5));
  });

  it('computes average episodes', () => {
    const profile = buildTasteProfile(mockCacheDocs);
    expect(profile.avgEpisodes).toBe(Math.round((24 + 12 + 13 + 26 + 12) / 5));
  });

  it('counts studios', () => {
    const profile = buildTasteProfile(mockCacheDocs);
    expect(profile.topStudios[0].studio).toBe('MAPPA');
    expect(profile.topStudios[0].count).toBe(2);
  });

  it('builds genre co-occurrence pairs', () => {
    const profile = buildTasteProfile(mockCacheDocs);
    expect(profile.genrePairs.length).toBeGreaterThan(0);
    const actionFantasy = profile.genrePairs.find(([a, b]) =>
      (a === 'Action' && b === 'Fantasy') || (a === 'Fantasy' && b === 'Action')
    );
    expect(actionFantasy).toBeDefined();
    expect(actionFantasy![2]).toBe(2);
  });

  it('handles empty input', () => {
    const profile = buildTasteProfile([]);
    expect(profile.topGenres).toEqual([]);
    expect(profile.topStudios).toEqual([]);
    expect(profile.avgScore).toBe(70);
    expect(profile.avgEpisodes).toBe(13);
    expect(profile.totalCompleted).toBe(0);
  });

  it('handles null fields', () => {
    const profile = buildTasteProfile([
      { genres: null, studio: null, average_score: null, episodes: null },
    ]);
    expect(profile.topGenres).toEqual([]);
    expect(profile.topStudios).toEqual([]);
    expect(profile.avgScore).toBe(70);
    expect(profile.avgEpisodes).toBe(13);
  });
});

describe('generateQuestions', () => {
  it('generates 4 questions for a normal profile', () => {
    const profile = buildTasteProfile(mockCacheDocs);
    const questions = generateQuestions(profile);
    expect(questions).toHaveLength(4);
  });

  it('first question is mood with genre options', () => {
    const profile = buildTasteProfile(mockCacheDocs);
    const questions = generateQuestions(profile);
    expect(questions[0].id).toBe('mood');
    expect(questions[0].options.length).toBeGreaterThanOrEqual(3);
    expect(questions[0].options.some((o) => o.value === 'mix')).toBe(true);
  });

  it('includes length, status, and popularity questions', () => {
    const profile = buildTasteProfile(mockCacheDocs);
    const questions = generateQuestions(profile);
    const ids = questions.map((q) => q.id);
    expect(ids).toContain('length');
    expect(ids).toContain('status');
    expect(ids).toContain('popularity');
  });

  it('skips mood question if fewer than 2 genres', () => {
    const profile = buildTasteProfile([
      { genres: 'Action', studio: 'MAPPA', average_score: 80, episodes: 12 },
    ]);
    const questions = generateQuestions(profile);
    expect(questions.every((q) => q.id !== 'mood')).toBe(true);
    expect(questions).toHaveLength(3);
  });
});

describe('buildFiltersFromAnswers', () => {
  const profile = buildTasteProfile(mockCacheDocs);

  it('uses selected genre for mood answer', () => {
    const filters = buildFiltersFromAnswers(profile, { mood: 'Romance', length: 'any', status: 'any', popularity: 'any' });
    expect(filters.genres).toContain('Romance');
  });

  it('uses top 3 genres for mix answer', () => {
    const filters = buildFiltersFromAnswers(profile, { mood: 'mix', length: 'any', status: 'any', popularity: 'any' });
    expect(filters.genres.length).toBe(3);
  });

  it('sets maxEpisodes for short', () => {
    const filters = buildFiltersFromAnswers(profile, { mood: 'mix', length: 'short', status: 'any', popularity: 'any' });
    expect(filters.maxEpisodes).toBe(14);
  });

  it('sets maxEpisodes for medium', () => {
    const filters = buildFiltersFromAnswers(profile, { mood: 'mix', length: 'medium', status: 'any', popularity: 'any' });
    expect(filters.maxEpisodes).toBe(52);
  });

  it('sets null maxEpisodes for long', () => {
    const filters = buildFiltersFromAnswers(profile, { mood: 'mix', length: 'long', status: 'any', popularity: 'any' });
    expect(filters.maxEpisodes).toBeNull();
  });

  it('sets status filter', () => {
    const filters = buildFiltersFromAnswers(profile, { mood: 'mix', length: 'any', status: 'RELEASING', popularity: 'any' });
    expect(filters.status).toBe('RELEASING');
  });

  it('sets null status for any', () => {
    const filters = buildFiltersFromAnswers(profile, { mood: 'mix', length: 'any', status: 'any', popularity: 'any' });
    expect(filters.status).toBeNull();
  });

  it('sets higher minScore for popular', () => {
    const filters = buildFiltersFromAnswers(profile, { mood: 'mix', length: 'any', status: 'any', popularity: 'popular' });
    expect(filters.minScore).toBe(70);
    expect(filters.sort).toBe('POPULARITY_DESC');
  });

  it('sets lower minScore for hidden gems', () => {
    const filters = buildFiltersFromAnswers(profile, { mood: 'mix', length: 'any', status: 'any', popularity: 'hidden' });
    expect(filters.minScore).toBe(45);
    expect(filters.sort).toBe('SCORE_DESC');
  });
});
