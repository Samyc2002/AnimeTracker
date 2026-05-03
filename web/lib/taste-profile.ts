import type { TasteProfile, QuizQuestion, RecommendationFilters } from '@/lib/types';

interface CacheLike {
  genres: string | null;
  studio: string | null;
  average_score: number | null;
  episodes: number | null;
}

const CONTRASTING_GENRES: Record<string, string[]> = {
  Action: ['Romance', 'Slice of Life', 'Drama', 'Comedy'],
  Romance: ['Action', 'Thriller', 'Horror', 'Sci-Fi'],
  Comedy: ['Drama', 'Horror', 'Thriller', 'Psychological'],
  Drama: ['Comedy', 'Action', 'Adventure', 'Ecchi'],
  'Slice of Life': ['Action', 'Fantasy', 'Sci-Fi', 'Horror'],
  Fantasy: ['Slice of Life', 'Sports', 'Drama'],
  'Sci-Fi': ['Romance', 'Slice of Life', 'Sports'],
  Horror: ['Comedy', 'Romance', 'Slice of Life'],
  Thriller: ['Comedy', 'Romance', 'Slice of Life'],
  Sports: ['Sci-Fi', 'Fantasy', 'Horror'],
};

export function buildTasteProfile(cacheDocuments: CacheLike[]): TasteProfile {
  const genreCounts = new Map<string, number>();
  const studioCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  let scoreSum = 0;
  let scoreCount = 0;
  let epsSum = 0;
  let epsCount = 0;

  for (const doc of cacheDocuments) {
    const genres = doc.genres
      ? doc.genres.split(',').map((g) => g.trim()).filter(Boolean)
      : [];

    for (const g of genres) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    }

    for (let i = 0; i < genres.length; i++) {
      for (let j = i + 1; j < genres.length; j++) {
        const key = [genres[i], genres[j]].sort().join('|');
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }

    if (doc.studio) {
      studioCounts.set(doc.studio, (studioCounts.get(doc.studio) || 0) + 1);
    }

    if (doc.average_score != null) {
      scoreSum += doc.average_score;
      scoreCount++;
    }

    if (doc.episodes != null) {
      epsSum += doc.episodes;
      epsCount++;
    }
  }

  const total = cacheDocuments.length || 1;

  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: Math.round((count / total) * 100),
    }));

  const topStudios = [...studioCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([studio, count]) => ({ studio, count }));

  const genrePairs: [string, string, number][] = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => {
      const [a, b] = key.split('|');
      return [a, b, count];
    });

  return {
    topGenres,
    topStudios,
    avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 70,
    avgEpisodes: epsCount > 0 ? Math.round(epsSum / epsCount) : 13,
    totalCompleted: cacheDocuments.length,
    genrePairs,
  };
}

export function generateQuestions(profile: TasteProfile): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  if (profile.topGenres.length >= 2) {
    const primary = profile.topGenres[0].genre;
    const contrasts = CONTRASTING_GENRES[primary] || [];
    const contrastGenre = profile.topGenres.find(
      (g) => contrasts.includes(g.genre)
    );
    const secondary = contrastGenre?.genre || profile.topGenres[1].genre;
    const third = profile.topGenres.find(
      (g) => g.genre !== primary && g.genre !== secondary
    );

    const options = [
      { label: primary, value: primary },
      { label: secondary, value: secondary },
    ];
    if (third) options.push({ label: third.genre, value: third.genre });
    options.push({ label: 'Mix it up', value: 'mix' });

    questions.push({
      id: 'mood',
      text: `What are you in the mood for?`,
      options,
    });
  }

  const avgEps = profile.avgEpisodes;
  questions.push({
    id: 'length',
    text: 'How long of a series?',
    options: [
      { label: avgEps <= 13 ? 'Quick watch (12 eps)' : 'Short (12 eps or fewer)', value: 'short' },
      { label: 'Standard (13-50 eps)', value: 'medium' },
      { label: 'Long series (50+ eps)', value: 'long' },
      { label: "Doesn't matter", value: 'any' },
    ],
  });

  questions.push({
    id: 'status',
    text: 'Currently airing or completed?',
    options: [
      { label: 'Airing right now', value: 'RELEASING' },
      { label: 'Finished series', value: 'FINISHED' },
      { label: 'Either', value: 'any' },
    ],
  });

  questions.push({
    id: 'popularity',
    text: profile.avgScore > 75
      ? 'Looking for a crowd favorite or something different?'
      : 'What kind of show are you after?',
    options: [
      { label: 'Popular picks', value: 'popular' },
      { label: 'Hidden gem', value: 'hidden' },
      { label: 'Anything good', value: 'any' },
    ],
  });

  return questions;
}

export function buildFiltersFromAnswers(
  profile: TasteProfile,
  answers: Record<string, string>,
): RecommendationFilters {
  const topGenreNames = profile.topGenres.slice(0, 5).map((g) => g.genre);
  let genres: string[];

  if (answers.mood === 'mix') {
    genres = topGenreNames.slice(0, 3);
  } else if (answers.mood) {
    const picked = answers.mood;
    const companions = profile.genrePairs
      .filter(([a, b]) => a === picked || b === picked)
      .map(([a, b]) => (a === picked ? b : a))
      .slice(0, 2);
    genres = [picked, ...companions];
  } else {
    genres = topGenreNames.slice(0, 3);
  }

  let maxEpisodes: number | null = null;
  if (answers.length === 'short') maxEpisodes = 14;
  else if (answers.length === 'medium') maxEpisodes = 52;

  let status: 'RELEASING' | 'FINISHED' | null = null;
  if (answers.status === 'RELEASING') status = 'RELEASING';
  else if (answers.status === 'FINISHED') status = 'FINISHED';

  let minScore = 50;
  let sort: 'SCORE_DESC' | 'TRENDING_DESC' | 'POPULARITY_DESC' = 'SCORE_DESC';
  if (answers.popularity === 'popular') {
    minScore = 70;
    sort = 'POPULARITY_DESC';
  } else if (answers.popularity === 'hidden') {
    minScore = 45;
    sort = 'SCORE_DESC';
  }

  return {
    genres,
    status,
    minScore,
    maxEpisodes,
    sort,
    excludeMediaIds: [],
  };
}
