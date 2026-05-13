'use client';

import { useTitle } from '@/lib/useTitle';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWeeklyAiring, getCachedAiring, saveAiringToCache, mediaToWatchlistEntry, getErrorMessage } from '@/lib/anime-provider';
import { backfillSeriesId } from '@/lib/series-resolver';
import Image from 'next/image';
import AddToPlaylist from '@/components/AddToPlaylist';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Spinner';
import { enqueueSnackbar } from 'notistack';
import type { AiringSchedule } from '@/lib/types';
import { getRandomQuote } from '@/lib/loading-quotes';

function getWeekRange(offset: number = 0) {
  const now = new Date();
  const startOfWeek = new Date(now);
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(now.getDate() + mondayOffset + offset * 7);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return {
    from: Math.floor(startOfWeek.getTime() / 1000),
    to: Math.floor(endOfWeek.getTime() / 1000),
    startDate: startOfWeek,
  };
}

function formatTime(unix: number) {
  const d = new Date(unix * 1000);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDayHeader(date: Date) {
  return {
    day: date.toLocaleDateString(undefined, { weekday: 'long' }),
    date: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
  };
}

function isToday(date: Date) {
  const now = new Date();
  return date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
}

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6]; // Mon=0 through Sun=6 (offsets from startOfWeek)

export default function AiringPage() {
  useTitle('Airing Schedule');
  const router = useRouter();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const { authed, userId } = useAuth();
  const [schedules, setSchedules] = useState<AiringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [trackedIds, setTrackedIds] = useState<Set<number>>(new Set());
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [loadingQuote] = useState(() => getRandomQuote('general'));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const start = Date.now();
      const { from, to } = getWeekRange(weekOffset);

      async function minDelay() {
        const elapsed = Date.now() - start;
        if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
      }

      const cached = await getCachedAiring(from);
      if (cached && !cached.stale) {
        if (!cancelled) {
          setSchedules(cached.schedules);
          await minDelay();
          setLoading(false);
        }
        return;
      }

      const allSchedules: AiringSchedule[] = [];
      let page = 1;
      let hasMore = true;

      try {
        while (hasMore && page <= 5) {
          const result = await fetchWeeklyAiring(from, to, page);
          if (cancelled) return;
          allSchedules.push(...result.schedules);
          hasMore = result.hasNextPage;
          page++;
        }
      } catch {
        // Rate limit or network error — show what we have
      }

      if (!cancelled) {
        setSchedules(allSchedules.length > 0 ? allSchedules : (cached?.schedules || []));
        await minDelay();
        setLoading(false);
        if (allSchedules.length > 0) {
          saveAiringToCache(from, allSchedules).catch(() => {});
        }
      }
    }
    load();

    return () => { cancelled = true; };
  }, [weekOffset]);

  useEffect(() => {
    async function loadTracked() {
      if (!userId) return;
      try {
        const { data: existing } = await supabase
          .from('watchlist_entries')
          .select('canonical_anilist_id')
          .eq('user_id', userId)
          .not('canonical_anilist_id', 'is', null)
          .limit(500);
        const ids = new Set<number>(
          (existing || []).map((doc) => doc.canonical_anilist_id as number)
        );
        setTrackedIds(ids);
      } catch {
        // Not logged in or error
      }
    }
    loadTracked();
  }, [userId]);

  async function handleTrack(e: React.MouseEvent, s: AiringSchedule) {
    e.stopPropagation();
    const media = s.media;
    if (!media || trackingId === s.mediaId || !userId) return;

    setTrackingId(s.mediaId);
    try {
      const entry = mediaToWatchlistEntry(media);
      const { data: doc, error } = await supabase
        .from('watchlist_entries')
        .insert({ ...entry, user_id: userId, import_source: 'manual', canonical_anilist_id: media.id })
        .select()
        .single();
      if (error) throw error;
      backfillSeriesId(doc.id, s.mediaId, async (id, data) => {
        await supabase.from('watchlist_entries').update(data).eq('id', id);
      }).catch(() => {});
      setTrackedIds((prev) => new Set(prev).add(s.mediaId));
      enqueueSnackbar('Added to watchlist', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
    setTrackingId(null);
  }

  const { startDate } = getWeekRange(weekOffset);

  const seen = new Set<number>();
  const deduped = schedules.filter((s) => {
    if (seen.has(s.mediaId)) return false;
    seen.add(s.mediaId);
    return true;
  });

  const grouped = new Map<number, AiringSchedule[]>();
  for (const s of deduped) {
    const jsDay = new Date(s.airingAt * 1000).getDay();
    const monBasedDay = jsDay === 0 ? 6 : jsDay - 1;
    if (!grouped.has(monBasedDay)) grouped.set(monBasedDay, []);
    grouped.get(monBasedDay)!.push(s);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-200">Airing Schedule</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className={`text-sm ${theme.link} transition-colors`}
          >
            &larr; Prev Week
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs px-2 py-1 rounded bg-[#111827] text-gray-400 hover:text-gray-200 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className={`text-sm ${theme.link} transition-colors`}
          >
            Next Week &rarr;
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Spinner />
          <p className="text-base text-gray-400 italic mt-2">{loadingQuote}</p>
        </div>
      ) : (
        <div className="-mx-4 sm:-mx-6 lg:-mx-[calc((100vw-64rem)/2+1.5rem)] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[90rem] mx-auto">
          <div className="hidden lg:grid grid-cols-7 gap-2 sm:gap-4 sticky top-[57px] z-30 bg-[#0b0e14] pb-2 pt-1">
            {DAYS_OF_WEEK.map((dow) => {
              const dayDate = new Date(startDate);
              dayDate.setDate(startDate.getDate() + dow);
              const { day, date } = formatDayHeader(dayDate);
              const today = isToday(dayDate);
              return (
                <div
                  key={dow}
                  className={`text-center py-2 rounded-lg ${
                    today
                      ? `${theme.btnBg} border ${theme.btnBorder}`
                      : 'bg-[#1c2333] border border-[#253040]'
                  }`}
                >
                  <div className={`text-sm font-semibold ${today ? theme.btnText : 'text-gray-300'}`}>{day}</div>
                  <div className="text-xs text-gray-500">{date}</div>
                </div>
              );
            })}
          </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2 sm:gap-4">
          {DAYS_OF_WEEK.map((dow) => {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + dow);
            const { day, date } = formatDayHeader(dayDate);
            const items = grouped.get(dow) || [];
            const today = isToday(dayDate);

            return (
              <div key={dow} className="min-w-0">
                <div
                  className={`text-center py-2 mb-3 rounded-lg lg:hidden ${
                    today
                      ? `${theme.btnBg} border ${theme.btnBorder}`
                      : 'bg-[#141925]'
                  }`}
                >
                  <div className={`text-sm font-semibold ${today ? theme.btnText : 'text-gray-300'}`}>
                    {day}
                  </div>
                  <div className="text-xs text-gray-500">{date}</div>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">No anime</p>
                ) : (
                  <div className="space-y-2">
                    {items.filter((s) => !sfwMode || !s.media?.isAdult).map((s) => {
                      const media = s.media;
                      if (!media) return null;
                      const title = media.title.english || media.title.romaji;
                      const isTracked = trackedIds.has(s.mediaId);

                      return (
                        <div
                          key={`${s.mediaId}-${s.episode}`}
                          className={`bg-[#141925] rounded-lg overflow-hidden hover:bg-[#1c2333] transition-colors group cursor-pointer ${media.isAdult ? 'border border-red-500/40' : ''}`}
                          onClick={() => router.push(`/anime/${s.mediaId}`)}
                        >
                          <div className="relative w-full aspect-[3/4]">
                            <Image
                              src={media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '/placeholder.png'}
                              alt={title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <span className="text-xs font-bold text-white">
                                Ep {s.episode}
                              </span>
                            </div>
                            {authed && (
                              <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                <AddToPlaylist mediaId={s.mediaId} />
                              </div>
                            )}
                            {authed && (
                              <button
                                onClick={(e) => handleTrack(e, s)}
                                disabled={isTracked || trackingId === s.mediaId}
                                className={`absolute top-1.5 right-1.5 px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                                  isTracked
                                    ? 'bg-emerald-600/90 text-white opacity-100'
                                    : `${theme.activeTab} text-white opacity-0 group-hover:opacity-90`
                                }`}
                              >
                                {isTracked ? 'Tracked' : trackingId === s.mediaId ? '...' : '+ Track'}
                              </button>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium text-gray-200 truncate" title={title}>
                              {title}
                            </p>
                            <p className={`text-[10px] ${theme.btnText} mt-0.5`}>
                              {formatTime(s.airingAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
        </div>
      )}
    </div>
  );
}
