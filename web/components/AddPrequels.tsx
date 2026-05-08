'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { fetchAnimeDetail, mediaToWatchlistEntry, getErrorMessage } from '@/lib/anime-provider';
import { backfillSeriesId } from '@/lib/series-resolver';
import { enqueueSnackbar } from 'notistack';
import type { AnimeDetail } from '@/lib/types';
import type { WatchStatus } from '@/lib/types';

const STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectPrequels(animeId: number): Promise<AnimeDetail[]> {
  const prequels: AnimeDetail[] = [];
  const visited = new Set<number>();
  let currentId = animeId;

  while (true) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const detail = await fetchAnimeDetail(currentId);
    const prequelEdge = detail.relations.edges.find(
      (e) => e.relationType === 'PREQUEL' && e.node.type === 'ANIME'
    );

    if (!prequelEdge) break;

    await delay(500);
    const prequelDetail = await fetchAnimeDetail(prequelEdge.node.id);
    prequels.unshift(prequelDetail);
    currentId = prequelEdge.node.id;
  }

  return prequels;
}

export default function AddPrequels({ anime }: { anime: AnimeDetail }) {
  const { userId } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hasPrequels, setHasPrequels] = useState<boolean | null>(null);
  const [allAdded, setAllAdded] = useState(false);
  const [checking, setChecking] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const addingRef = useRef(false);

  useEffect(() => {
    const has = anime.relations.edges.some(
      (e) => e.relationType === 'PREQUEL' && e.node.type === 'ANIME'
    );
    setHasPrequels(has);
    if (!has) {
      setChecking(false);
      return;
    }

    async function checkPrequels() {
      try {
        if (!userId) { setChecking(false); return; }
        const prequels = await collectPrequels(anime.id);
        if (prequels.length === 0) {
          setAllAdded(true);
          setChecking(false);
          return;
        }
        const { data: existing } = await supabase
          .from('watchlist_entries')
          .select('media_id, id_mal')
          .eq('user_id', userId)
          .limit(500);
        const existingIds = new Set<number>();
        for (const doc of existing || []) {
          existingIds.add(doc.media_id);
          if (doc.id_mal) existingIds.add(doc.id_mal);
        }
        setAllAdded(prequels.every((p) => existingIds.has(p.id) || (p.idMal && existingIds.has(p.idMal))));
      } catch {
        // Can't check — leave enabled
      }
      setChecking(false);
    }
    checkPrequels();
  }, [anime]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false);
    }
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (addingRef.current) {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!adding) return;
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function (...args) {
      if (addingRef.current && !confirm('Prequels are still being added. Leave anyway?')) return;
      return originalPushState(...args);
    };
    history.replaceState = function (...args) {
      return originalReplaceState(...args);
    };

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [adding]);

  if (!hasPrequels) return null;

  async function handleAdd(status: WatchStatus) {
    setAdding(true);
    addingRef.current = true;
    setShowDropdown(false);

    try {
      if (!userId) throw new Error('Not logged in');
      const prequels = await collectPrequels(anime.id);

      if (prequels.length === 0) {
        enqueueSnackbar('No prequels found', { variant: 'info' });
        setAdding(false);
        addingRef.current = false;
        return;
      }

      const { data: existing } = await supabase
        .from('watchlist_entries')
        .select('media_id, id_mal')
        .eq('user_id', userId)
        .limit(500);
      const existingIds = new Set<number>();
      for (const doc of existing || []) {
        existingIds.add(doc.media_id);
        if (doc.id_mal) existingIds.add(doc.id_mal);
      }

      let added = 0;
      for (const prequel of prequels) {
        if (existingIds.has(prequel.id) || (prequel.idMal && existingIds.has(prequel.idMal))) continue;
        const entry = mediaToWatchlistEntry({
          id: prequel.id,
          idMal: prequel.idMal,
          title: { romaji: prequel.title.romaji, english: prequel.title.english },
          coverImage: prequel.coverImage,
          status: prequel.status,
          episodes: prequel.episodes,
          nextAiringEpisode: prequel.nextAiringEpisode,
        });
        const { data: newDoc, error } = await supabase
          .from('watchlist_entries')
          .insert({
            ...entry,
            user_id: userId,
            watch_status: status,
          })
          .select()
          .single();
        if (error) throw error;
        backfillSeriesId(newDoc.id, prequel.id, async (id, data) => {
          await supabase.from('watchlist_entries').update(data).eq('id', id);
        }).catch(() => {});
        added++;
      }

      if (added > 0) {
        enqueueSnackbar(`Added ${added} prequel${added > 1 ? 's' : ''} as ${status}`, { variant: 'success' });
      }
      setAllAdded(true);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
    setAdding(false);
    addingRef.current = false;
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => !allAdded && setShowDropdown(!showDropdown)}
        disabled={adding || allAdded || checking}
        className="px-3 py-1.5 bg-[#141925] border border-[#253040] text-sm rounded-lg font-medium text-gray-300 hover:bg-[#1c2333] transition-colors disabled:opacity-50"
      >
        {checking ? '...' : adding ? 'Adding...' : allAdded ? 'Prequels Added' : '+ Add Prequels'}
      </button>
      {showDropdown && (
        <div className="absolute left-0 top-full mt-1 z-[100] w-40 bg-[#141925] border border-[#253040] rounded-lg shadow-xl overflow-hidden">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => handleAdd(s)}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#1c2333] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
