'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID } from '@/lib/appwrite';
import { fetchWeeklyAiring, mediaToWatchlistEntry } from '@/lib/anilist';
import Image from 'next/image';
import type { AiringSchedule } from '@/lib/types';

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
  const router = useRouter();
  const [schedules, setSchedules] = useState<AiringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [trackedIds, setTrackedIds] = useState<Set<number>>(new Set());
  const [trackingId, setTrackingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { from, to } = getWeekRange(weekOffset);
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
        // AniList rate limit or network error — show what we have
      }

      if (!cancelled) {
        setSchedules(allSchedules);
        setLoading(false);
      }
    }
    load();

    return () => { cancelled = true; };
  }, [weekOffset]);

  useEffect(() => {
    async function loadTracked() {
      try {
        const user = await account.get();
        const existing = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
          Query.equal('user_id', user.$id),
          Query.select(['media_id']),
          Query.limit(500),
        ]);
        setTrackedIds(new Set(existing.documents.map((d) => (d as unknown as { media_id: number }).media_id)));
      } catch {
        // Not logged in or error
      }
    }
    loadTracked();
  }, []);

  async function handleTrack(e: React.MouseEvent, s: AiringSchedule) {
    e.stopPropagation();
    const media = s.media;
    if (!media || trackingId === s.mediaId) return;

    setTrackingId(s.mediaId);
    try {
      const user = await account.get();
      const entry = mediaToWatchlistEntry(media);
      await databases.createDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, ID.unique(), {
        ...entry,
        user_id: user.$id,
      });
      setTrackedIds((prev) => new Set(prev).add(s.mediaId));
    } catch {
      // Failed
    }
    setTrackingId(null);
  }

  const { startDate } = getWeekRange(weekOffset);

  const grouped = new Map<number, AiringSchedule[]>();
  for (const s of schedules) {
    const jsDay = new Date(s.airingAt * 1000).getDay();
    const monBasedDay = jsDay === 0 ? 6 : jsDay - 1;
    if (!grouped.has(monBasedDay)) grouped.set(monBasedDay, []);
    grouped.get(monBasedDay)!.push(s);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-200">Airing Schedule</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
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
            className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
          >
            Next Week &rarr;
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center mt-12">
          <div className="w-6 h-6 border-2 border-[#253040] border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          {DAYS_OF_WEEK.map((dow) => {
            const dayDate = new Date(startDate);
            dayDate.setDate(startDate.getDate() + dow);
            const { day, date } = formatDayHeader(dayDate);
            const items = grouped.get(dow) || [];
            const today = isToday(dayDate);

            return (
              <div key={dow} className="min-w-0">
                <div
                  className={`text-center py-2 mb-3 rounded-lg ${
                    today
                      ? 'bg-teal-600/20 border border-teal-500/40'
                      : 'bg-[#141925]'
                  }`}
                >
                  <div className={`text-sm font-semibold ${today ? 'text-teal-400' : 'text-gray-300'}`}>
                    {day}
                  </div>
                  <div className="text-xs text-gray-500">{date}</div>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">No anime</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((s) => {
                      const media = s.media;
                      if (!media) return null;
                      const title = media.title.english || media.title.romaji;
                      const isTracked = trackedIds.has(s.mediaId);

                      return (
                        <div
                          key={`${s.mediaId}-${s.episode}`}
                          className="bg-[#141925] rounded-lg overflow-hidden hover:bg-[#1c2333] transition-colors group cursor-pointer"
                          onClick={() => router.push(`/anime/${s.mediaId}`)}
                        >
                          <div className="relative w-full aspect-[3/4]">
                            <Image
                              src={media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '/icon-128.png'}
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
                            <button
                              onClick={(e) => handleTrack(e, s)}
                              disabled={isTracked || trackingId === s.mediaId}
                              className={`absolute top-1.5 right-1.5 px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                                isTracked
                                  ? 'bg-emerald-600/90 text-white opacity-100'
                                  : 'bg-teal-600/90 hover:bg-teal-500 text-white opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              {isTracked ? 'Tracked' : trackingId === s.mediaId ? '...' : '+ Track'}
                            </button>
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium text-gray-200 truncate" title={title}>
                              {title}
                            </p>
                            <p className="text-[10px] text-teal-400 mt-0.5">
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
      )}
    </div>
  );
}
