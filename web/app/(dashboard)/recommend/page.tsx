'use client';

import { useTitle } from '@/lib/useTitle';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { enqueueSnackbar } from 'notistack';
import { useAuth } from '@/lib/auth-context';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { buildFiltersFromAnswers } from '@/lib/taste-profile';
import AddToWatchlist from '@/components/AddToWatchlist';
import AddToPlaylist from '@/components/AddToPlaylist';
import Image from 'next/image';
import RequireAuth from '@/components/RequireAuth';
import { Spinner } from '@/components/ui/Spinner';
import type { TasteProfile, QuizQuestion, AniListMedia } from '@/lib/types';

type Phase = 'loading' | 'quiz' | 'searching' | 'results';

function RecommendPage() {
  useTitle('Recommendations');
  const router = useRouter();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const { userId } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [insufficient, setInsufficient] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        if (!userId) throw new Error('Not authenticated');
        const res = await fetch('/api/taste-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json();
        if (data.insufficient) {
          setInsufficient(true);
          setPhase('quiz');
          return;
        }
        setProfile(data.profile);
        setQuestions(data.questions);
        setPhase('quiz');
      } catch {
        enqueueSnackbar('Failed to analyze watchlist', { variant: 'error' });
      }
    }
    loadProfile();
  }, [userId]);

  const fetchRecommendations = useCallback(async () => {
    if (!profile || !userId) return;
    setPhase('searching');
    try {
      const filters = buildFiltersFromAnswers(profile, answers);
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, filters }),
      });
      const data = await res.json();
      const media = sfwMode
        ? (data.results || []).filter((m: AniListMedia) => !m.isAdult)
        : data.results || [];
      setResults(media);
      setPhase('results');
    } catch {
      enqueueSnackbar('Failed to get recommendations', { variant: 'error' });
      setPhase('quiz');
    }
  }, [profile, answers, sfwMode, userId]);

  function selectAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (currentQ < questions.length - 1) {
      setCurrentQ((prev) => prev + 1);
    } else {
      fetchRecommendations();
    }
  }

  function reset() {
    setCurrentQ(0);
    setAnswers({});
    setPhase('quiz');
  }

  if (phase === 'loading') {
    return (
      <div className="text-center mt-16">
        <div className="flex justify-center mb-4"><Spinner size="lg" /></div>
        <p className="text-gray-400 text-sm">Analyzing your taste...</p>
      </div>
    );
  }

  if (insufficient) {
    return (
      <div className="text-center mt-16">
        <h1 className="text-xl font-bold text-gray-200 mb-3">Not Enough Data Yet</h1>
        <p className="text-gray-500 text-sm mb-4">
          Complete at least 3 anime so we can learn your taste.
        </p>
        <button
          onClick={() => router.push('/search')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${theme.activeTab} text-white`}
        >
          Browse Anime
        </button>
      </div>
    );
  }

  if (phase === 'quiz' && profile) {
    const q = questions[currentQ];
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-200 mb-2">Get Recommendations</h1>

        <div className="bg-[#141925] rounded-lg p-4 mb-6 border border-[#253040]">
          <p className="text-sm text-gray-400 mb-1">Based on {profile.totalCompleted} completed anime</p>
          <p className="text-sm text-gray-200">
            You love{' '}
            {profile.topGenres.slice(0, 3).map((g, i) => (
              <span key={g.genre}>
                {i > 0 && (i === profile.topGenres.slice(0, 3).length - 1 ? ' and ' : ', ')}
                <span className={`font-semibold ${theme.btnText}`}>{g.genre}</span>
              </span>
            ))}
            {profile.topStudios.length > 0 && (
              <>, especially from <span className="font-semibold text-gray-300">{profile.topStudios[0].studio}</span></>
            )}
          </p>
        </div>

        {q && (
          <div className="max-w-md mx-auto">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-gray-500">{currentQ + 1} of {questions.length}</p>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-6 h-1 rounded-full ${i <= currentQ ? theme.activeTab : 'bg-[#253040]'}`}
                  />
                ))}
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-200 mb-4">{q.text}</h2>

            <div className="space-y-2">
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => selectAnswer(q.id, opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors border ${
                    answers[q.id] === opt.value
                      ? `${theme.activeTab} text-white border-transparent`
                      : 'bg-[#141925] text-gray-300 border-[#253040] hover:bg-[#1c2333]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'searching') {
    return (
      <div className="text-center mt-16">
        <div className="flex justify-center mb-4"><Spinner size="lg" /></div>
        <p className="text-gray-400 text-sm">Finding your next watch...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-200">Recommended for You</h1>
        <button
          onClick={reset}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Try again
        </button>
      </div>

      {results.length === 0 ? (
        <div className="text-center mt-12">
          <p className="text-gray-500 mb-4">No matches found. Try different preferences!</p>
          <button
            onClick={reset}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${theme.activeTab} text-white`}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {results.map((media) => {
            const title = media.title.english || media.title.romaji;
            return (
              <div
                key={media.id}
                className="bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors group"
                onClick={() => router.push(`/anime/${media.id}`)}
              >
                <div className="relative w-full aspect-[3/4]">
                  <Image
                    src={media.coverImage?.extraLarge || media.coverImage?.large || '/placeholder.png'}
                    alt={title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <AddToPlaylist mediaId={media.id} />
                    <AddToWatchlist media={media} />
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-200 truncate" title={title}>{title}</p>
                  {media.episodes && <p className="text-[10px] text-gray-500 mt-0.5">{media.episodes} eps</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RecommendPageGuarded() {
  return <RequireAuth><RecommendPage /></RequireAuth>;
}
