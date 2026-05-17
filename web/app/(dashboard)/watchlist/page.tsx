'use client';

import { useTitle } from '@/lib/useTitle';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import AnimeCard from '@/components/AnimeCard';
import AddToPlaylist from '@/components/AddToPlaylist';
import Image from 'next/image';
import { enqueueSnackbar } from 'notistack';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-context';
import RequireAuth from '@/components/RequireAuth';
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/StatusBadge';
import { fireClientAchievementEvent } from '@/lib/achievements/fire-event';
import type { WatchStatus } from '@/lib/types';
import { getRandomQuote } from '@/lib/loading-quotes';
import StreamingBanner from '@/components/StreamingBanner';

function upgradeImageUrl(url: string): string {
  return url.replace(/\/(?:small|medium)\//, '/large/');
}

interface WatchlistDoc {
  id: string;
  user_id: string;
  media_id: number;
  id_mal: number | null;
  title_romaji: string;
  title_english: string;
  cover_url: string;
  status: string;
  total_episodes: number | null;
  next_airing_episode: number | null;
  watch_status?: WatchStatus;
  is_adult?: boolean;
  manual_nsfw?: boolean;
  series_id?: number | null;
}

const WATCH_STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];
const ALL_FILTER = 'All';
const ALL_AIRING = 'All';
const AIRING_STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS'] as const;
const PAGE_SIZE = 30;

const airingStatusLabels: Record<string, { label: string; className: string; tone: StatusBadgeTone }> = {
  RELEASING: { label: 'Airing', className: 'bg-emerald-900/60 text-emerald-300', tone: 'emerald' },
  FINISHED: { label: 'Finished', className: 'bg-blue-900/60 text-blue-300', tone: 'blue' },
  NOT_YET_RELEASED: { label: 'Upcoming', className: 'bg-amber-900/60 text-amber-300', tone: 'amber' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-900/60 text-red-300', tone: 'red' },
  HIATUS: { label: 'Hiatus', className: 'bg-gray-700/60 text-gray-300', tone: 'gray' },
};

type ViewMode = 'list' | 'card';

export default function WatchlistPageGuarded() {
  return <RequireAuth><WatchlistPage /></RequireAuth>;
}

function WatchlistPage() {
  useTitle('Watchlist');
  const searchParams = useSearchParams();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const { userId } = useAuth();
  const [entries, setEntries] = useState<WatchlistDoc[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingQuote, setLoadingQuote] = useState('');
  useEffect(() => { setLoadingQuote(getRandomQuote('general')); }, []);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<WatchStatus | typeof ALL_FILTER>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('status');
      if (param && [...WATCH_STATUSES, ALL_FILTER].includes(param)) return param as WatchStatus;
    }
    return 'Watching';
  });
  const [page, setPage] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('page');
      return p ? Math.max(0, parseInt(p) - 1) : 0;
    }
    return 0;
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('watchlist_view') as ViewMode) || 'list';
    }
    return 'list';
  });
  const [airingFilter, setAiringFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('airing') || ALL_AIRING;
    }
    return ALL_AIRING;
  });
  const [selectedFolder, setSelectedFolder] = useState<{ seriesId: number; seriesName: string; entries: WatchlistDoc[] } | null>(null);
  const [episodeProgress, setEpisodeProgress] = useState<Record<number, number>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: WatchlistDoc } | null>(null);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    const start = Date.now();
    try {
      if (!userId) throw new Error('Not authenticated');

      let query = supabase
        .from('watchlist_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filter !== ALL_FILTER) {
        query = query.eq('watch_status', filter);
      }

      if (airingFilter !== ALL_AIRING) {
        query = query.eq('status', airingFilter);
      }

      const { data: docs, error } = await query;
      if (error) throw error;

      setEntries((docs || []) as WatchlistDoc[]);

      // Get total count for current filter
      let countQuery = supabase
        .from('watchlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (filter !== ALL_FILTER) countQuery = countQuery.eq('watch_status', filter);
      if (airingFilter !== ALL_AIRING) countQuery = countQuery.eq('status', airingFilter);
      const { count: totalCount } = await countQuery;
      setTotalEntries(totalCount || 0);

      // Single query for all counts instead of 5 separate ones
      const { data: allStatusDocs } = await supabase
        .from('watchlist_entries')
        .select('watch_status')
        .eq('user_id', userId)
        .limit(5000);

      const newCounts: Record<string, number> = { [ALL_FILTER]: (allStatusDocs || []).length };
      for (const s of WATCH_STATUSES) {
        newCounts[s] = (allStatusDocs || []).filter((d) => d.watch_status === s).length;
      }
      setCounts(newCounts);

      // Fetch episode progress in a single RPC call
      const wlDocs = (docs || []) as WatchlistDoc[];
      const allIds: number[] = [];
      const malToMedia = new Map<number, number>();
      console.log("wlDocs", wlDocs);
      for (const d of wlDocs) {
        if (d.id_mal) {
          allIds.push(d.id_mal);
          malToMedia.set(d.id_mal, d.media_id);
        } else {
          allIds.push(d.media_id);
        }
      }
      console.log("allIds", allIds);
      if (allIds.length > 0) {
        const { data: progressData } = await supabase.rpc('get_episode_progress', {
          p_user_id: userId,
          p_media_ids: allIds,
        });
        const epMap: Record<number, number> = {};
        for (const row of (progressData || [])) {
          const mid = row.media_id as number;
          const canonical = malToMedia.get(mid) ?? mid;
          epMap[canonical] = (epMap[canonical] || 0) + (row.count as number);
        }
        setEpisodeProgress(epMap);
      }
    } catch {
      // Not authenticated — layout will redirect
    }
    const elapsed = Date.now() - start;
    if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
    setLoading(false);
  }, [filter, airingFilter, page, userId]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  function updateFilter(newFilter: WatchStatus | typeof ALL_FILTER) {
    setFilter(newFilter);
    setPage(0);
    const params = new URLSearchParams(window.location.search);
    if (newFilter === ALL_FILTER) params.delete('status');
    else params.set('status', newFilter);
    params.delete('page');
    const qs = params.toString();
    window.history.replaceState({}, '', `/watchlist${qs ? '?' + qs : ''}`);
  }

  function updateAiringFilter(newAiring: string) {
    setAiringFilter(newAiring);
    setPage(0);
    const params = new URLSearchParams(window.location.search);
    if (newAiring === ALL_AIRING) params.delete('airing');
    else params.set('airing', newAiring);
    params.delete('page');
    const qs = params.toString();
    window.history.replaceState({}, '', `/watchlist${qs ? '?' + qs : ''}`);
  }

  function updatePage(newPage: number) {
    setPage(newPage);
    const params = new URLSearchParams(window.location.search);
    if (newPage === 0) params.delete('page');
    else params.set('page', String(newPage + 1));
    const qs = params.toString();
    window.history.replaceState({}, '', `/watchlist${qs ? '?' + qs : ''}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeFromWatchlist(entry: WatchlistDoc) {
    await supabase.from('watchlist_entries').delete().eq('id', entry.id);
    enqueueSnackbar('Removed from watchlist', { variant: 'success' });
    loadWatchlist();
  }

  async function updateWatchStatus(entry: WatchlistDoc, newStatus: WatchStatus) {
    await supabase.from('watchlist_entries').update({ watch_status: newStatus }).eq('id', entry.id);
    enqueueSnackbar(`Status changed to ${newStatus}`, { variant: 'success' });
    if (userId) fireClientAchievementEvent(userId, 'status_change');
    setSelectedFolder(null);
    loadWatchlist();
  }

  async function toggleManualNsfw(entry: WatchlistDoc) {
    const next = !entry.manual_nsfw;
    await supabase.from('watchlist_entries').update({ manual_nsfw: next }).eq('id', entry.id);
    enqueueSnackbar(next ? 'Marked as NSFW' : 'Unmarked NSFW', { variant: 'success' });
    setSelectedFolder(null);
    loadWatchlist();
  }

  function handleContextMenu(e: React.MouseEvent, entry: WatchlistDoc) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Loading watchlist...</p>
        <p className="text-base text-gray-400 italic mt-2">{loadingQuote}</p>
      </div>
    );
  }

  const displayEntries = sfwMode ? entries.filter((e) => !e.is_adult && !e.manual_nsfw) : entries;
  const totalPages = Math.ceil(totalEntries / PAGE_SIZE);

  // Group entries by series_id into folders
  type FolderOrEntry = { type: 'entry'; entry: WatchlistDoc } | { type: 'folder'; seriesId: number; seriesName: string; entries: WatchlistDoc[] };

  const grouped: FolderOrEntry[] = (() => {
    const seriesMap = new Map<number, WatchlistDoc[]>();
    const standalone: WatchlistDoc[] = [];

    for (const entry of displayEntries) {
      const sid = entry.series_id;
      if (sid != null) {
        if (!seriesMap.has(sid)) seriesMap.set(sid, []);
        seriesMap.get(sid)!.push(entry);
      } else {
        standalone.push(entry);
      }
    }

    const result: FolderOrEntry[] = [];
    const processed = new Set<string>();

    for (const entry of displayEntries) {
      if (processed.has(entry.id)) continue;
      const sid = entry.series_id;
      if (sid != null && seriesMap.has(sid)) {
        const group = seriesMap.get(sid)!;
        if (group.length > 1) {
          for (const e of group) processed.add(e.id);
          const firstName = group[0].title_english || group[0].title_romaji || 'Unknown Series';
          const seriesName = firstName.replace(/\s*(Season|Part|Cour)\s*\d+.*$/i, '').replace(/\s*\d+(st|nd|rd|th)\s*Season.*$/i, '').trim() || firstName;
          result.push({ type: 'folder', seriesId: sid, seriesName, entries: group });
        } else {
          processed.add(entry.id);
          result.push({ type: 'entry', entry });
        }
      } else {
        processed.add(entry.id);
        result.push({ type: 'entry', entry });
      }
    }

    return result;
  })();

  function openFolder(folder: { seriesId: number; seriesName: string; entries: WatchlistDoc[] }) {
    setSelectedFolder(folder);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-200">Watchlist</h1>
        <div className="flex gap-1 bg-[#141925] rounded-lg p-0.5 border border-[#253040]">
          <button
            onClick={() => { setViewMode('list'); localStorage.setItem('watchlist_view', 'list'); }}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? `${theme.activeTab} text-white` : 'text-gray-500 hover:text-gray-300'}`}
            title="List view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button
            onClick={() => { setViewMode('card'); localStorage.setItem('watchlist_view', 'card'); }}
            className={`p-1.5 rounded transition-colors ${viewMode === 'card' ? `${theme.activeTab} text-white` : 'text-gray-500 hover:text-gray-300'}`}
            title="Card view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto thin-scrollbar">
        {[ALL_FILTER, ...WATCH_STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => updateFilter(s as WatchStatus | typeof ALL_FILTER)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === s
                ? `${theme.activeTab} text-white`
                : 'bg-[#141925] text-gray-400 hover:text-gray-200'
            }`}
          >
            {s} <span className="text-xs opacity-60">({counts[s] || 0})</span>
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto thin-scrollbar">
        <span className="text-xs text-gray-600 self-center mr-1 whitespace-nowrap">Airing:</span>
        {[ALL_AIRING, ...AIRING_STATUSES].map((s) => {
          const label = s === ALL_AIRING ? 'All' : (airingStatusLabels[s]?.label || s);
          return (
            <button
              key={s}
              onClick={() => updateAiringFilter(s)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                airingFilter === s
                  ? 'bg-[#253040] text-gray-200'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <StreamingBanner userId={userId} />

      {displayEntries.length === 0 ? (
        <p className="text-gray-500 text-center mt-8">
          {totalEntries === 0 ? 'No anime tracked yet.' : `No anime matching these filters`}
        </p>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {grouped.map((item) => {
            if (item.type === 'entry') {
              const entry = item.entry;
              const title = entry.title_english || entry.title_romaji || 'Unknown';
              const airingInfo = airingStatusLabels[entry.status] || airingStatusLabels.FINISHED;
              return (
                <div key={entry.id} className="group/row" onContextMenu={(e) => handleContextMenu(e, entry)}>
                  <AnimeCard
                    title={title}
                    coverUrl={upgradeImageUrl(entry.cover_url)}
                    status={entry.status}
                    episodes={entry.total_episodes}
                    watchedCount={(entry.watch_status === 'Watching' || entry.watch_status === 'Dropped') ? (episodeProgress[entry.media_id] || 0) : undefined}
                    totalForProgress={(entry.watch_status === 'Watching' || entry.watch_status === 'Dropped') ? (entry.total_episodes || undefined) : undefined}
                    airedEpisodes={(entry.watch_status === 'Watching' || entry.watch_status === 'Dropped') && entry.next_airing_episode ? entry.next_airing_episode - 1 : undefined}
                    isAdult={entry.is_adult || entry.manual_nsfw}
                    href={`/anime/${entry.id_mal || entry.media_id}`}
                    action={
                      <div className="flex items-center gap-1">
                        <div className="opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <AddToPlaylist mediaId={entry.media_id} />
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${airingInfo.className}`}>
                          {airingInfo.label}
                        </span>
                      </div>
                    }
                  />
                </div>
              );
            }

            const folder = item;
            return (
              <div
                key={`folder-${folder.seriesId}`}
                className="flex gap-3 bg-[#141925] rounded-lg p-3 cursor-pointer hover:bg-[#1c2333] transition-colors border border-[#253040]/50"
                onClick={() => openFolder(folder)}
              >
                <div className="grid grid-cols-2 gap-[2px] w-14 flex-shrink-0 aspect-[3/4] rounded overflow-hidden bg-[#0b0e14]">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const e = folder.entries[i];
                    return e ? (
                      <div key={e.id} className="relative w-full h-full">
                        <Image src={upgradeImageUrl(e.cover_url) || '/placeholder.png'} alt="" fill className="object-cover" sizes="28px" unoptimized />
                      </div>
                    ) : (
                      <div key={`empty-${i}`} className="bg-[#1c2333]" />
                    );
                  })}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                  <p className="text-sm font-semibold text-gray-200 truncate">{folder.seriesName}</p>
                  <span className="text-xs text-gray-500">{folder.entries.length} entries</span>
                </div>
                <div className="flex items-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-500">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {grouped.map((item) => {
            if (item.type === 'entry') {
              const entry = item.entry;
              const title = entry.title_english || entry.title_romaji || 'Unknown';
              const airingInfo = airingStatusLabels[entry.status] || airingStatusLabels.FINISHED;
              return (
                <Link
                  key={entry.id}
                  href={`/anime/${entry.id_mal || entry.media_id}`}
                  className={`bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors group/card relative ${entry.is_adult || entry.manual_nsfw ? 'border border-red-500/40' : ''}`}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                >
                  <div className="relative w-full aspect-[3/4]">
                    <Image src={upgradeImageUrl(entry.cover_url) || '/placeholder.png'} alt={title} fill className="object-cover" unoptimized />
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}>
                      <AddToPlaylist mediaId={entry.media_id} />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <StatusBadge tone={airingInfo.tone}>{airingInfo.label}</StatusBadge>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate" title={title}>{title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {episodeProgress[entry.media_id]
                        ? entry.watch_status === 'Dropped'
                          ? `Dropped at ep ${episodeProgress[entry.media_id]}`
                          : `${episodeProgress[entry.media_id]}/${entry.total_episodes ?? '?'} eps watched`
                        : entry.total_episodes
                          ? `${entry.total_episodes} eps`
                          : null}
                    </p>
                    {(entry.watch_status === 'Watching' || entry.watch_status === 'Dropped') && episodeProgress[entry.media_id] > 0 && (() => {
                      const watched = episodeProgress[entry.media_id];
                      const total = entry.total_episodes;
                      const aired = entry.next_airing_episode ? entry.next_airing_episode - 1 : total;
                      const pct = total ? Math.min((watched / total) * 100, 100) : 60;
                      const airedPct = total && aired ? Math.min((aired / total) * 100, 100) : undefined;
                      return (
                        <div className="mt-1">
                          <div className="w-full h-1 bg-[#1e2736] rounded-full overflow-hidden relative">
                            {airedPct != null && airedPct > pct && (
                              <div className="absolute inset-y-0 left-0 rounded-full bg-gray-600/40" style={{ width: `${airedPct}%` }} />
                            )}
                            <div className={`h-full rounded-full ${theme.activeTab} transition-all relative z-10`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {(entry.watch_status === 'Watching' || entry.watch_status === 'Dropped') && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#0b0e14]/90 border border-[#253040] rounded-lg text-xs text-gray-200 whitespace-nowrap opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none z-20">
                      {episodeProgress[entry.media_id]
                        ? `${episodeProgress[entry.media_id]}/${entry.total_episodes ?? '?'} eps watched`
                        : 'Not started yet'}
                    </div>
                  )}
                </Link>
              );
            }

            const folder = item;
            return (
              <div
                key={`folder-${folder.seriesId}`}
                className="bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors border border-[#253040]/50"
                onClick={() => openFolder(folder)}
              >
                <div className="relative w-full aspect-[3/4]">
                  <div className="grid grid-cols-2 gap-[2px] w-full h-full rounded-lg overflow-hidden bg-[#0b0e14]">
                    {Array.from({ length: 4 }).map((_, i) => {
                      const e = folder.entries[i];
                      return e ? (
                        <div key={e.id} className="relative w-full h-full">
                          <Image src={upgradeImageUrl(e.cover_url) || '/placeholder.png'} alt="" fill className="object-cover" unoptimized />
                        </div>
                      ) : (
                        <div key={`empty-${i}`} className="bg-[#1c2333]" />
                      );
                    })}
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-2 z-10">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-[#253040] text-gray-300">
                      {folder.entries.length} entries
                    </span>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-200 truncate">{folder.seriesName}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => updatePage(page - 1)}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm bg-[#141925] border border-[#253040] rounded-lg text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => updatePage(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm bg-[#141925] border border-[#253040] rounded-lg text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {sfwMode && (
        <p className="text-[10px] text-gray-600 mt-4 text-center">
          * Counts include all entries. Some may be hidden by SFW mode.
        </p>
      )}

      {selectedFolder && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedFolder(null)} />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
            <div className="bg-[#141925] rounded-t-2xl border-t border-x border-[#253040] max-h-[70vh] flex flex-col mx-auto max-w-lg">
              <div className="flex items-center justify-between p-4 border-b border-[#253040] flex-shrink-0">
                <div className="flex-1 min-w-0 mr-3">
                  <h3 className="text-sm font-semibold text-gray-200 truncate">{selectedFolder.seriesName}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedFolder.entries.length} entries</p>
                </div>
                <button
                  onClick={() => setSelectedFolder(null)}
                  className="p-1.5 rounded-lg hover:bg-[#253040] transition-colors text-gray-400"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {selectedFolder.entries.map((entry) => {
                  const title = entry.title_english || entry.title_romaji || 'Unknown';
                  const airingInfo = airingStatusLabels[entry.status] || airingStatusLabels.FINISHED;
                  return (
                    <div
                      key={entry.id}
                      className="group/row"
                      onContextMenu={(e) => handleContextMenu(e, entry)}
                    >
                      <AnimeCard
                        title={title}
                        coverUrl={upgradeImageUrl(entry.cover_url)}
                        status={entry.status}
                        episodes={entry.total_episodes}
                        watchedCount={(entry.watch_status === 'Watching' || entry.watch_status === 'Dropped') ? (episodeProgress[entry.media_id] || 0) : undefined}
                        totalForProgress={(entry.watch_status === 'Watching' || entry.watch_status === 'Dropped') ? (entry.total_episodes || undefined) : undefined}
                        airedEpisodes={(entry.watch_status === 'Watching' || entry.watch_status === 'Dropped') && entry.next_airing_episode ? entry.next_airing_episode - 1 : undefined}
                        isAdult={entry.is_adult || entry.manual_nsfw}
                        href={`/anime/${entry.id_mal || entry.media_id}`}
                        onClick={() => setSelectedFolder(null)}
                        action={
                          <div className="flex items-center gap-1">
                            <div className="opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <AddToPlaylist mediaId={entry.media_id} />
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${airingInfo.className}`}>
                              {airingInfo.label}
                            </span>
                          </div>
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-3 mt-1" />
            </div>
          </div>
        </>
      )}

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-50 bg-[#141925] border border-[#253040] rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 176), top: Math.min(contextMenu.y, window.innerHeight - 250) }}
          >
            <p className="px-3 py-1.5 text-xs text-gray-500 truncate max-w-[200px]">
              {contextMenu.entry.title_english || contextMenu.entry.title_romaji}
            </p>
            <div className="border-t border-[#253040] my-1" />
            {WATCH_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { updateWatchStatus(contextMenu.entry, s); setContextMenu(null); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-[#1c2333] transition-colors ${
                  (contextMenu.entry.watch_status || 'Watching') === s ? `${theme.btnText}` : 'text-gray-300'
                }`}
              >
                {(contextMenu.entry.watch_status || 'Watching') === s ? '● ' : '○ '}{s}
              </button>
            ))}
            <div className="border-t border-[#253040] my-1" />
            <button
              onClick={() => { toggleManualNsfw(contextMenu.entry); setContextMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-[#1c2333] transition-colors"
            >
              {contextMenu.entry.manual_nsfw ? 'Unmark NSFW' : 'Mark as NSFW'}
            </button>
            <div className="border-t border-[#253040] my-1" />
            <button
              onClick={() => { removeFromWatchlist(contextMenu.entry); setContextMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-[#1c2333] transition-colors"
            >
              Remove from watchlist
            </button>
          </div>
        </>
      )}
    </div>
  );
}
