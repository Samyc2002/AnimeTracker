'use client';

import { useTitle } from '@/lib/useTitle';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Query } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID } from '@/lib/appwrite';
import AnimeCard from '@/components/AnimeCard';
import AddToPlaylist from '@/components/AddToPlaylist';
import Image from 'next/image';
import { enqueueSnackbar } from 'notistack';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import RequireAuth from '@/components/RequireAuth';
import type { WatchStatus } from '@/lib/types';

function upgradeImageUrl(url: string): string {
  return url.replace(/\/(?:small|medium)\//, '/large/');
}

interface WatchlistDoc {
  $id: string;
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

const airingStatusLabels: Record<string, { label: string; className: string }> = {
  RELEASING: { label: 'Airing', className: 'bg-emerald-900/60 text-emerald-300' },
  FINISHED: { label: 'Finished', className: 'bg-blue-900/60 text-blue-300' },
  NOT_YET_RELEASED: { label: 'Upcoming', className: 'bg-amber-900/60 text-amber-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-900/60 text-red-300' },
  HIATUS: { label: 'Hiatus', className: 'bg-gray-700/60 text-gray-300' },
};

type ViewMode = 'list' | 'card';

export default function WatchlistPageGuarded() {
  return <RequireAuth><WatchlistPage /></RequireAuth>;
}

function WatchlistPage() {
  useTitle('Watchlist');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [entries, setEntries] = useState<WatchlistDoc[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(true);
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
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: WatchlistDoc } | null>(null);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const user = await account.get();

      const queries: string[] = [
        Query.equal('user_id', user.$id) as unknown as string,
        Query.orderDesc('$createdAt') as unknown as string,
        Query.limit(PAGE_SIZE) as unknown as string,
        Query.offset(page * PAGE_SIZE) as unknown as string,
      ];

      if (filter !== ALL_FILTER) {
        queries.push(Query.equal('watch_status', filter) as unknown as string);
      }

      if (airingFilter !== ALL_AIRING) {
        queries.push(Query.equal('status', airingFilter) as unknown as string);
      }

      const watchlist = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, queries as unknown as string[]);

      const docs = watchlist.documents as unknown as WatchlistDoc[];
      setEntries(docs);
      setTotalEntries(watchlist.total);

      // Fetch counts for each status
      const countQueries = await Promise.all(
        WATCH_STATUSES.map(async (s) => {
          const res = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
            Query.equal('user_id', user.$id),
            Query.equal('watch_status', s),
            Query.limit(1),
          ]);
          return [s, res.total] as [string, number];
        })
      );

      const allRes = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.limit(1),
      ]);

      const newCounts: Record<string, number> = { [ALL_FILTER]: allRes.total };
      for (const [s, count] of countQueries) {
        newCounts[s] = count;
      }
      setCounts(newCounts);
    } catch {
      // Not authenticated — layout will redirect
    }
    setLoading(false);
  }, [filter, airingFilter, page]);

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
    await databases.deleteDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, entry.$id);
    enqueueSnackbar('Removed from watchlist', { variant: 'success' });
    loadWatchlist();
  }

  async function updateWatchStatus(entry: WatchlistDoc, newStatus: WatchStatus) {
    await databases.updateDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, entry.$id, {
      watch_status: newStatus,
    });
    enqueueSnackbar(`Status changed to ${newStatus}`, { variant: 'success' });
    loadWatchlist();
  }

  async function toggleManualNsfw(entry: WatchlistDoc) {
    const next = !entry.manual_nsfw;
    await databases.updateDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, entry.$id, {
      manual_nsfw: next,
    });
    enqueueSnackbar(next ? 'Marked as NSFW' : 'Unmarked NSFW', { variant: 'success' });
    loadWatchlist();
  }

  function handleContextMenu(e: React.MouseEvent, entry: WatchlistDoc) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }

  if (loading) {
    return <p className="text-gray-500 text-center mt-12">Loading watchlist...</p>;
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
      if (processed.has(entry.$id)) continue;
      const sid = entry.series_id;
      if (sid != null && seriesMap.has(sid)) {
        const group = seriesMap.get(sid)!;
        if (group.length > 1) {
          for (const e of group) processed.add(e.$id);
          const firstName = group[0].title_english || group[0].title_romaji || 'Unknown Series';
          const seriesName = firstName.replace(/\s*(Season|Part|Cour)\s*\d+.*$/i, '').replace(/\s*\d+(st|nd|rd|th)\s*Season.*$/i, '').trim() || firstName;
          result.push({ type: 'folder', seriesId: sid, seriesName, entries: group });
        } else {
          processed.add(entry.$id);
          result.push({ type: 'entry', entry });
        }
      } else {
        processed.add(entry.$id);
        result.push({ type: 'entry', entry });
      }
    }

    return result;
  })();

  function toggleFolder(seriesId: number) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(seriesId)) next.delete(seriesId);
      else next.add(seriesId);
      return next;
    });
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

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
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

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
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
                <div key={entry.$id} className="group/row" onContextMenu={(e) => handleContextMenu(e, entry)}>
                  <AnimeCard
                    title={title}
                    coverUrl={upgradeImageUrl(entry.cover_url)}
                    status={entry.status}
                    episodes={entry.total_episodes}
                    isAdult={entry.is_adult || entry.manual_nsfw}
                    onClick={() => router.push(`/anime/${entry.id_mal || entry.media_id}`)}
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
            const isExpanded = expandedFolders.has(folder.seriesId);
            return (
              <div key={`folder-${folder.seriesId}`}>
                <div
                  className="flex gap-3 bg-[#141925] rounded-lg p-3 cursor-pointer hover:bg-[#1c2333] transition-colors border border-[#253040]/50"
                  onClick={() => toggleFolder(folder.seriesId)}
                >
                  <div className="relative w-14 h-20 flex-shrink-0">
                    {folder.entries.slice(0, 3).reverse().map((e, i) => (
                      <div key={e.$id} className="absolute rounded overflow-hidden" style={{ top: i * 3, left: i * 3, width: 48, height: 68, zIndex: 3 - i }}>
                        <Image src={upgradeImageUrl(e.cover_url) || '/placeholder.png'} alt="" fill className="object-cover" sizes="48px" unoptimized />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                    <p className="text-sm font-semibold text-gray-200 truncate">{folder.seriesName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{folder.entries.length} entries</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1.5 border-l-2 border-[#253040] pl-3">
                    {folder.entries.map((entry) => {
                      const title = entry.title_english || entry.title_romaji || 'Unknown';
                      const airingInfo = airingStatusLabels[entry.status] || airingStatusLabels.FINISHED;
                      return (
                        <div key={entry.$id} className="group/row" onContextMenu={(e) => handleContextMenu(e, entry)}>
                          <AnimeCard
                            title={title}
                            coverUrl={upgradeImageUrl(entry.cover_url)}
                            status={entry.status}
                            episodes={entry.total_episodes}
                            isAdult={entry.is_adult || entry.manual_nsfw}
                            onClick={() => router.push(`/anime/${entry.id_mal || entry.media_id}`)}
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
                )}
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
                <div
                  key={entry.$id}
                  className={`bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors group ${entry.is_adult || entry.manual_nsfw ? 'border border-red-500/40' : ''}`}
                  onClick={() => router.push(`/anime/${entry.id_mal || entry.media_id}`)}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                >
                  <div className="relative w-full aspect-[3/4]">
                    <Image src={upgradeImageUrl(entry.cover_url) || '/placeholder.png'} alt={title} fill className="object-cover" unoptimized />
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <AddToPlaylist mediaId={entry.media_id} />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${airingInfo.className}`}>{airingInfo.label}</span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate" title={title}>{title}</p>
                    {entry.total_episodes && <p className="text-[10px] text-gray-500 mt-0.5">{entry.total_episodes} eps</p>}
                  </div>
                </div>
              );
            }

            const folder = item;
            const isExpanded = expandedFolders.has(folder.seriesId);

            if (isExpanded) {
              return (
                <div key={`folder-${folder.seriesId}`} className="col-span-full">
                  <div
                    className="flex items-center gap-2 mb-2 cursor-pointer"
                    onClick={() => toggleFolder(folder.seriesId)}
                  >
                    <span className="text-sm font-semibold text-gray-300">{folder.seriesName}</span>
                    <span className="text-xs text-gray-500">({folder.entries.length})</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-500 rotate-180">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-3">
                    {folder.entries.map((entry) => {
                      const title = entry.title_english || entry.title_romaji || 'Unknown';
                      const airingInfo = airingStatusLabels[entry.status] || airingStatusLabels.FINISHED;
                      return (
                        <div
                          key={entry.$id}
                          className={`bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors group ${entry.is_adult || entry.manual_nsfw ? 'border border-red-500/40' : ''}`}
                          onClick={() => router.push(`/anime/${entry.id_mal || entry.media_id}`)}
                          onContextMenu={(e) => handleContextMenu(e, entry)}
                        >
                          <div className="relative w-full aspect-[3/4]">
                            <Image src={upgradeImageUrl(entry.cover_url) || '/placeholder.png'} alt={title} fill className="object-cover" unoptimized />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${airingInfo.className}`}>{airingInfo.label}</span>
                            </div>
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium text-gray-200 truncate" title={title}>{title}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={`folder-${folder.seriesId}`}
                className="bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors border border-[#253040]/50"
                onClick={() => toggleFolder(folder.seriesId)}
              >
                <div className="relative w-full aspect-[3/4]">
                  {folder.entries.slice(0, 3).reverse().map((e, i) => (
                    <div key={e.$id} className="absolute inset-0" style={{ top: i * 4, left: i * 4, right: -(i * 4), bottom: -(i * 4), zIndex: 3 - i, opacity: 1 - i * 0.15 }}>
                      <Image src={upgradeImageUrl(e.cover_url) || '/placeholder.png'} alt="" fill className="object-cover rounded-lg" unoptimized />
                    </div>
                  ))}
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
