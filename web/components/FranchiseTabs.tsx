'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { enqueueSnackbar } from 'notistack';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import type { AnimeDetail } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FranchiseEntry {
  anilist_id: number;
  relation_type: string;
}

interface WatchlistStatus {
  watch_status: string;
  id: string;
}

type ComputeStatus = 'checking' | 'computing' | 'done' | 'singleton' | 'error';

// ─── Constants ───────────────────────────────────────────────────────────────

const RELATION_BADGE: Record<string, string> = {
  SPIN_OFF:    'Spin-off',
  SUMMARY:     'Recap',
  ALTERNATIVE: 'Alt version',
};

const STATUS_COLORS: Record<string, string> = {
  Watching:  'bg-emerald-900/60 text-emerald-300',
  Completed: 'bg-purple-900/60 text-purple-300',
  Planned:   'bg-blue-900/60 text-blue-300',
  Dropped:   'bg-red-900/60 text-red-300',
};

// ─── Loading state messages (client-side elapsed time) ───────────────────────

function loadingMessage(elapsedMs: number): { main: string; sub: string } {
  if (elapsedMs < 60_000) {
    return {
      main: 'Building watch order — checking for related entries…',
      sub:  '(this only happens once per franchise)',
    };
  }
  if (elapsedMs < 3 * 60_000) {
    return {
      main: 'Taking longer than usual — checking AniList for related entries…',
      sub:  '',
    };
  }
  return {
    main: 'Still working — this is a large franchise',
    sub:  '',
  };
}

// ─── WatchOrder tab content ───────────────────────────────────────────────────

interface WatchOrderTabProps {
  entries: FranchiseEntry[];
  truncated: boolean;
  currentAnilistId: number;
  coverCache: Record<number, string>;
  titleCache: Record<number, string>;
  formatCache: Record<number, string>;
  yearCache: Record<number, number | null>;
  watchlistStatuses: Record<number, WatchlistStatus>;
  statusesLoaded: boolean;
  onAddSuccess: () => void;
  theme: ReturnType<typeof getTheme>;
  authed: boolean;
  userId: string | null;
}

function WatchOrderTab({
  entries,
  truncated,
  currentAnilistId,
  coverCache,
  titleCache,
  formatCache,
  yearCache,
  watchlistStatuses,
  statusesLoaded,
  onAddSuccess,
  theme,
  authed,
  userId,
}: WatchOrderTabProps) {
  const router = useRouter();
  const [adding, setAdding] = useState<number | null>(null);

  async function handleAdd(anilistId: number) {
    if (!authed || !userId || adding) return;
    setAdding(anilistId);
    try {
      await supabase.from('watchlist_entries').insert({
        user_id: userId,
        media_id: anilistId,
        canonical_anilist_id: anilistId,
        import_source: 'manual',
        watch_status: 'Planned',
        title_romaji: titleCache[anilistId] ?? '',
        title_english: titleCache[anilistId] ?? '',
        cover_url: coverCache[anilistId] ?? '',
        status: 'FINISHED',
        total_episodes: null,
        next_airing_episode: null,
        next_airing_at: null,
        is_adult: false,
        series_id: null,
      });
      onAddSuccess();
    } catch {
      // Non-critical
    }
    setAdding(null);
  }

  return (
    <div>
      {/* Timeline */}
      <div className="relative pl-8">
        {/* Vertical connecting line */}
        <div
          className="absolute left-[15px] top-3 bottom-3 w-[2px] bg-[#253040]"
          aria-hidden
        />

        <div className="space-y-3">
          {entries.map((entry, i) => {
            const isCurrent = entry.anilist_id === currentAnilistId;
            const cover  = coverCache[entry.anilist_id];
            const title  = titleCache[entry.anilist_id] ?? `Series ${entry.anilist_id}`;
            const fmt    = formatCache[entry.anilist_id];
            const yr     = yearCache[entry.anilist_id];
            const status = watchlistStatuses[entry.anilist_id];
            const badge  = RELATION_BADGE[entry.relation_type];

            return (
              <div key={entry.anilist_id} className="relative flex gap-3 items-start">
                {/* Numbered node */}
                <div
                  className={`absolute -left-8 w-[24px] h-[24px] rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold z-10 ${
                    isCurrent
                      ? `${theme.activeTab} text-white`
                      : 'bg-[#141925] border border-[#253040] text-gray-500'
                  }`}
                  aria-hidden
                >
                  {i + 1}
                </div>

                {/* Entry card */}
                <div
                  className={`flex-1 flex gap-2.5 rounded-lg p-2 transition-opacity cursor-pointer max-w-[520px] ${
                    isCurrent
                      ? `border-2 border-${theme.accent}-500 bg-[#141925]`
                      : 'border border-[#253040] bg-[#141925] opacity-75 hover:opacity-100'
                  }`}
                  onClick={() => !isCurrent && router.push(`/anime/${entry.anilist_id}`)}
                >
                  {/* Poster */}
                  <div className="w-9 h-[52px] flex-shrink-0 rounded overflow-hidden bg-[#0b0e14]">
                    {cover ? (
                      <Image
                        src={cover}
                        alt=""
                        width={36}
                        height={52}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                    <div className="flex items-start gap-1.5 flex-wrap">
                      <p className={`text-xs font-medium leading-snug ${isCurrent ? 'text-gray-100' : 'text-gray-300'}`}>
                        {title}
                      </p>
                      {badge && (
                        <span className="px-1 py-0.5 rounded text-[9px] bg-[#253040] text-gray-400 font-medium flex-shrink-0">
                          {badge}
                        </span>
                      )}
                    </div>
                    {yr && (
                      <p className="text-[10px] text-gray-500">{yr}</p>
                    )}
                    {/* Watchlist status or Add button — fixed height to prevent layout shift */}
                    <div className="mt-1 h-[18px] flex items-center">
                      {!statusesLoaded ? (
                        <div className="h-3 w-12 rounded bg-[#253040] animate-pulse" />
                      ) : status ? (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${STATUS_COLORS[status.watch_status] ?? 'bg-gray-800 text-gray-400'}`}>
                          {status.watch_status}
                        </span>
                      ) : authed && !isCurrent ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAdd(entry.anilist_id); }}
                          disabled={adding === entry.anilist_id}
                          className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
                        >
                          {adding === entry.anilist_id ? '…' : '+ Add'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Format badge — right-anchored, only if format is known */}
                  {fmt && (
                    <div className="flex items-center self-center flex-shrink-0 ml-auto pl-2">
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#253040] text-gray-400 font-medium uppercase tracking-wide">
                        {fmt}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {truncated && (
        <p className="mt-4 text-[10px] text-gray-600 text-center">
          Some related entries may not be shown.
        </p>
      )}

      <p className="mt-4 text-[10px] text-gray-600 leading-relaxed">
        Shown in chronological release order. For franchises with non-linear watch
        orders (Fate, Monogatari, etc.), you may want to consult a community viewing
        guide.
      </p>
    </div>
  );
}

// ─── Related Anime tab content ────────────────────────────────────────────────

interface RelatedAnimeTabProps {
  relations: AnimeDetail['relations']['edges'];
  theme: ReturnType<typeof getTheme>;
}

function formatRelation(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

const relationOrder = ['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'PARENT', 'SPIN_OFF', 'ALTERNATIVE', 'OTHER'];

function RelatedAnimeTab({ relations, theme }: RelatedAnimeTabProps) {
  const router = useRouter();
  const sorted = [...relations]
    .filter((e) => e.node.type === 'ANIME')
    .sort((a, b) => relationOrder.indexOf(a.relationType) - relationOrder.indexOf(b.relationType));

  if (sorted.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No related anime found.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
      {sorted.map((edge) => {
        const rel = edge.node;
        const relTitle = rel.title.english || rel.title.romaji;
        return (
          <div
            key={rel.id}
            className={`bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors ${rel.isAdult ? 'border border-red-500/40' : ''}`}
            onClick={() => router.push(`/anime/${rel.id}`)}
          >
            <div className="relative w-full aspect-[3/4]">
              <Image
                src={[rel.coverImage?.extraLarge, rel.coverImage?.large, rel.coverImage?.medium].find((u) => u && u.length > 0) || '/placeholder.png'}
                alt={relTitle}
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute top-1 left-1">
                <span className="px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-gray-300 font-medium">
                  {formatRelation(edge.relationType)}
                </span>
              </div>
            </div>
            <div className="p-2">
              <p className="text-xs font-medium text-gray-200 truncate" title={relTitle}>
                {relTitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main FranchiseTabs component ────────────────────────────────────────────

interface FranchiseTabsProps {
  anime: AnimeDetail;
  currentAnilistId: number;
  // null = has franchise relations but not cached yet (compute will run)
  // number = cached, this is the root ID
  // undefined = no franchise (singleton) — Watch Order tab hidden
  initialMembershipRootId: number | null | undefined;
}

export default function FranchiseTabs({
  anime,
  currentAnilistId,
  initialMembershipRootId,
}: FranchiseTabsProps) {
  const { authed, userId } = useAuth();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);

  const hasFranchise = initialMembershipRootId !== undefined;
  const animeRelations = anime.relations.edges.filter((e) => e.node.type === 'ANIME');
  const hasRelations = animeRelations.length > 0;

  // If no franchise and no related anime, render nothing
  if (!hasFranchise && !hasRelations) return null;

  // If no franchise, render Related Anime without tab UI
  if (!hasFranchise) {
    return (
      <div className="mt-8 mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Related Anime</h2>
        <RelatedAnimeTab relations={anime.relations.edges} theme={theme} />
      </div>
    );
  }

  return (
    <FranchiseTabsInner
      anime={anime}
      currentAnilistId={currentAnilistId}
      initialMembershipRootId={initialMembershipRootId}
      animeRelations={animeRelations}
      hasRelations={hasRelations}
      authed={authed}
      userId={userId}
      theme={theme}
    />
  );
}

// ─── Inner component (has franchise — handles SSE, tabs, state) ───────────────

interface InnerProps {
  anime: AnimeDetail;
  currentAnilistId: number;
  initialMembershipRootId: number | null;
  animeRelations: AnimeDetail['relations']['edges'];
  hasRelations: boolean;
  authed: boolean;
  userId: string | null;
  theme: ReturnType<typeof getTheme>;
}

function FranchiseTabsInner({
  anime,
  currentAnilistId,
  initialMembershipRootId,
  animeRelations,
  hasRelations,
  authed,
  userId,
  theme,
}: InnerProps) {
  const isCached = initialMembershipRootId !== null;

  const [computeStatus, setComputeStatus] = useState<ComputeStatus>(isCached ? 'done' : 'checking');
  const [entries, setEntries] = useState<FranchiseEntry[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [computeStarted, setComputeStarted] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState<'watch_order' | 'related'>(
    isCached ? 'watch_order' : 'related'
  );

  // Metadata caches for franchise entries (cover, title, format, year)
  const [coverCache, setCoverCache]   = useState<Record<number, string>>({});
  const [titleCache, setTitleCache]   = useState<Record<number, string>>({});
  const [formatCache, setFormatCache] = useState<Record<number, string>>({});
  const [yearCache, setYearCache]     = useState<Record<number, number | null>>({});
  const [watchlistStatuses, setWatchlistStatuses] = useState<Record<number, WatchlistStatus>>({});
  const [statusesLoaded, setStatusesLoaded] = useState(false);

  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Elapsed timer for loading messages ──────────────────────────────────
  useEffect(() => {
    if (computeStatus !== 'computing') {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      return;
    }
    elapsedRef.current = setInterval(() => {
      setElapsed(Date.now() - computeStarted);
    }, 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [computeStatus, computeStarted]);

  // ── Force recompute (retry button) ──────────────────────────────────────
  async function handleForceRecompute() {
    setComputeStatus('computing');
    setComputeStarted(Date.now());
    setComputeError(null);

    try {
      const res = await fetch('/api/franchise/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anilistId: currentAnilistId, force: true }),
      });

      if (!res.ok || !res.body) {
        setComputeStatus('error');
        setComputeError('Failed to start watch order rebuild.');
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line || line.startsWith(':')) continue;
          const dataLine = line.replace(/^data: /, '');
          try {
            const msg = JSON.parse(dataLine);
            if (msg.type === 'result') {
              if (msg.status === 'singleton') {
                setComputeStatus('singleton');
              } else {
                setEntries(msg.entries as FranchiseEntry[]);
                setTruncated(msg.truncated as boolean);
                setComputeStatus('done');
                setActiveTab('watch_order');
              }
            } else if (msg.type === 'error') {
              // Cooldown message: show as info toast, keep current watch order visible
              if (msg.message?.includes('please wait')) {
                enqueueSnackbar(msg.message, { variant: 'info' });
                setComputeStatus('done');
              } else {
                setComputeStatus('error');
                setComputeError(msg.message ?? 'Watch order rebuild failed.');
              }
            }
          } catch { /* malformed line */ }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setComputeStatus('error');
        setComputeError('Connection to watch order service lost.');
      }
    }
  }

  // ── Load franchise entries if already cached ─────────────────────────────
  useEffect(() => {
    if (!isCached || initialMembershipRootId === null) return;
    async function loadCached() {
      const { data } = await supabase
        .from('franchise_watch_orders')
        .select('ordered_entries, truncated')
        .eq('franchise_root_id', initialMembershipRootId)
        .limit(1);
      if (data?.[0]) {
        setEntries(data[0].ordered_entries as FranchiseEntry[]);
        setTruncated(data[0].truncated as boolean);
        setComputeStatus('done');
      }
    }
    loadCached();
  }, [isCached, initialMembershipRootId]);

  // ── Kick off SSE compute if not cached ───────────────────────────────────
  useEffect(() => {
    if (isCached) return;

    async function startCompute() {
      setComputeStatus('computing');
      setComputeStarted(Date.now());

      try {
        const res = await fetch('/api/franchise/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anilistId: currentAnilistId }),
        });

        if (!res.ok || !res.body) {
          setComputeStatus('error');
          setComputeError('Failed to start watch order computation.');
          return;
        }

        const reader = res.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.trim();
            if (!line || line.startsWith(':')) continue; // skip keepalive comments
            const dataLine = line.replace(/^data: /, '');
            try {
              const msg = JSON.parse(dataLine);
              if (msg.type === 'result') {
                if (msg.status === 'singleton') {
                  setComputeStatus('singleton');
                } else {
                  setEntries(msg.entries as FranchiseEntry[]);
                  setTruncated(msg.truncated as boolean);
                  setComputeStatus('done');
                  // Switch to Watch Order tab now that it's ready
                  setActiveTab('watch_order');
                }
              } else if (msg.type === 'error') {
                setComputeStatus('error');
                setComputeError(msg.message ?? 'Watch order computation failed.');
              }
            } catch { /* malformed line */ }
          }
        }
      } catch (err) {
        // Navigation away cancels the reader — not an error
        if ((err as Error)?.name !== 'AbortError') {
          setComputeStatus('error');
          setComputeError('Connection to watch order service lost.');
        }
      }
    }

    startCompute();

    return () => {
      // Cancel stream on unmount (navigation away)
      readerRef.current?.cancel().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAnilistId]);

  // ── Fetch cover/title/format/year metadata once entries are known ────────
  useEffect(() => {
    if (entries.length === 0) return;
    const ids = entries.map((e) => e.anilist_id);

    async function loadMeta() {
      const { data } = await supabase
        .from('series_metadata')
        .select('anilist_id, format, season_year')
        .in('anilist_id', ids);

      const fmtMap: Record<number, string> = {};
      const yrMap: Record<number, number | null> = {};
      for (const row of (data || [])) {
        fmtMap[row.anilist_id as number] = row.format as string;
        yrMap[row.anilist_id as number]  = row.season_year as number | null;
      }
      setFormatCache(fmtMap);
      setYearCache(yrMap);
    }

    async function loadCoversAndTitles() {
      const covers: Record<number, string> = {};
      const titles: Record<number, string> = {};

      covers[currentAnilistId] = anime.coverImage.extraLarge || anime.coverImage.large || anime.coverImage.medium || '';
      titles[currentAnilistId] = anime.title.english || anime.title.romaji || '';

      const { data } = await supabase
        .from('anime_cache')
        .select('anilist_id, cover_large, cover_medium, cover_small, title_english, title_romaji')
        .in('anilist_id', ids.filter((id) => id !== currentAnilistId));

      for (const row of (data || [])) {
        const id = row.anilist_id as number;
        covers[id] = (row.cover_large || row.cover_medium || row.cover_small || '') as string;
        titles[id] = (row.title_english || row.title_romaji || '') as string;
      }

      setCoverCache(covers);
      setTitleCache(titles);
    }

    loadMeta();
    loadCoversAndTitles();
  }, [entries, currentAnilistId, anime]);

  // ── Fetch watchlist statuses — separate effect so auth resolving after
  // entries load doesn't miss the re-run (entries ref is stable then) ────────
  useEffect(() => {
    if (entries.length === 0) return;
    const ids = entries.map((e) => e.anilist_id);

    setStatusesLoaded(false);

    if (!authed || !userId) {
      setStatusesLoaded(true);
      return;
    }

    async function loadWatchlistStatuses() {
      const { data } = await supabase
        .from('watchlist_entries')
        .select('canonical_anilist_id, watch_status, id')
        .eq('user_id', userId!)
        .in('canonical_anilist_id', ids)
        .not('canonical_anilist_id', 'is', null);

      const statusMap: Record<number, WatchlistStatus> = {};
      for (const row of (data || [])) {
        statusMap[row.canonical_anilist_id as number] = {
          watch_status: row.watch_status as string,
          id: row.id as string,
        };
      }
      setWatchlistStatuses(statusMap);
      setStatusesLoaded(true);
    }

    loadWatchlistStatuses();
  }, [entries, authed, userId]);

  // ── If singleton detected post-compute, hide watch order tab ────────────
  if (computeStatus === 'singleton') {
    if (!hasRelations) return null;
    return (
      <div className="mt-8 mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Related Anime</h2>
        <RelatedAnimeTab relations={anime.relations.edges} theme={theme} />
      </div>
    );
  }

  const tabs: { key: 'watch_order' | 'related'; label: string; show: boolean }[] = [
    { key: 'watch_order', label: 'Watch Order', show: true },
    { key: 'related',     label: 'Related Anime', show: hasRelations },
  ];

  const msg = loadingMessage(elapsed);

  return (
    <div className="mt-8 mb-8">
      {/* Tab buttons */}
      <div className="flex gap-1 mb-4 border-b border-[#253040]">
        {tabs.filter((t) => t.show).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px inline-flex items-center ${
              activeTab === tab.key
                ? `border-${theme.accent}-500 ${theme.btnText}`
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.key === 'watch_order' && computeStatus === 'computing' && (
              <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse align-middle" />
            )}
            {tab.key === 'watch_order' && (
              <span
                role="button"
                title={
                  computeStatus === 'computing'
                    ? 'Watch order is currently being rebuilt — please wait'
                    : 'Rebuild watch order — useful if entries are missing or wrong'
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (computeStatus === 'computing') {
                    enqueueSnackbar('Watch order is being rebuilt. Wait for it to finish before retrying.', { variant: 'info' });
                    return;
                  }
                  handleForceRecompute();
                }}
                className={
                  computeStatus === 'computing'
                    ? 'ml-1.5 inline-flex items-center text-gray-700 opacity-50 cursor-not-allowed'
                    : 'ml-1.5 inline-flex items-center text-gray-600 hover:text-gray-400 cursor-pointer transition-colors'
                }
              >
                {/* Refresh icon — inline SVG, no icon library dependency */}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'watch_order' && (
        <>
          {computeStatus === 'computing' || computeStatus === 'checking' ? (
            <div className="py-8 text-center space-y-1">
              <div className={`inline-block w-5 h-5 border-2 border-[#253040] ${theme.spinnerBorder} rounded-full animate-spin mb-3`} />
              <p className="text-sm text-gray-400">{msg.main}</p>
              {msg.sub && <p className="text-xs text-gray-600">{msg.sub}</p>}
            </div>
          ) : computeStatus === 'error' ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-gray-400">{computeError ?? 'Watch order computation timed out.'}</p>
              <button
                onClick={() => {
                  setComputeStatus('computing');
                  setComputeStarted(Date.now());
                  setComputeError(null);
                  // Re-trigger compute — claim-on-conflict pattern handles abandoned jobs
                  fetch('/api/franchise/compute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ anilistId: currentAnilistId }),
                  }).catch(() => {});
                }}
                className={`px-4 py-1.5 ${theme.btn} text-white text-sm rounded-lg font-medium transition-colors`}
              >
                Retry
              </button>
            </div>
          ) : computeStatus === 'done' && entries.length > 0 ? (
            <WatchOrderTab
              entries={entries}
              truncated={truncated}
              currentAnilistId={currentAnilistId}
              coverCache={coverCache}
              titleCache={titleCache}
              formatCache={formatCache}
              yearCache={yearCache}
              watchlistStatuses={watchlistStatuses}
              statusesLoaded={statusesLoaded}
              onAddSuccess={() => {
                if (!authed || !userId) return;
                const ids = entries.map((e) => e.anilist_id);
                supabase
                  .from('watchlist_entries')
                  .select('canonical_anilist_id, watch_status, id')
                  .eq('user_id', userId)
                  .in('canonical_anilist_id', ids)
                  .not('canonical_anilist_id', 'is', null)
                  .then(({ data }) => {
                    const statusMap: Record<number, WatchlistStatus> = {};
                    for (const row of (data || [])) {
                      statusMap[row.canonical_anilist_id as number] = {
                        watch_status: row.watch_status as string,
                        id: row.id as string,
                      };
                    }
                    setWatchlistStatuses(statusMap);
                  });
              }}
              theme={theme}
              authed={authed}
              userId={userId}
            />
          ) : null}
        </>
      )}

      {activeTab === 'related' && (
        <RelatedAnimeTab relations={anime.relations.edges} theme={theme} />
      )}
    </div>
  );
}
