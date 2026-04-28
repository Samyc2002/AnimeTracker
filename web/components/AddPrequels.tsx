'use client';

import { useState, useRef, useEffect } from 'react';
import { ID, Query } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID } from '@/lib/appwrite';
import { fetchAnimeDetail, mediaToWatchlistEntry } from '@/lib/anilist';
import { enqueueSnackbar } from 'notistack';
import type { AnimeDetail } from '@/lib/types';
import type { WatchStatus } from '@/lib/types';

const STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];

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

    const prequelDetail = await fetchAnimeDetail(prequelEdge.node.id);
    prequels.unshift(prequelDetail);
    currentId = prequelEdge.node.id;
  }

  return prequels;
}

export default function AddPrequels({ anime }: { anime: AnimeDetail }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hasPrequels, setHasPrequels] = useState<boolean | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const has = anime.relations.edges.some(
      (e) => e.relationType === 'PREQUEL' && e.node.type === 'ANIME'
    );
    setHasPrequels(has);
  }, [anime]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false);
    }
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  if (!hasPrequels) return null;

  async function handleAdd(status: WatchStatus) {
    setAdding(true);
    setShowDropdown(false);

    try {
      const user = await account.get();
      const prequels = await collectPrequels(anime.id);

      if (prequels.length === 0) {
        enqueueSnackbar('No prequels found', { variant: 'info' });
        setAdding(false);
        return;
      }

      const existing = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.limit(500),
      ]);
      const existingIds = new Set(
        existing.documents.map((d) => (d as unknown as { media_id: number }).media_id)
      );

      let added = 0;
      for (const prequel of prequels) {
        if (existingIds.has(prequel.id)) continue;
        const entry = mediaToWatchlistEntry({
          id: prequel.id,
          idMal: prequel.idMal,
          title: { romaji: prequel.title.romaji, english: prequel.title.english },
          coverImage: prequel.coverImage,
          status: prequel.status,
          episodes: prequel.episodes,
          nextAiringEpisode: prequel.nextAiringEpisode,
        });
        await databases.createDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, ID.unique(), {
          ...entry,
          user_id: user.$id,
          watch_status: status,
        });
        added++;
      }

      if (added > 0) {
        enqueueSnackbar(`Added ${added} prequel${added > 1 ? 's' : ''} as ${status}`, { variant: 'success' });
      } else {
        enqueueSnackbar('All prequels already in watchlist', { variant: 'info' });
      }
    } catch {
      enqueueSnackbar('Failed to add prequels', { variant: 'error' });
    }
    setAdding(false);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={adding}
        className="px-3 py-1.5 bg-[#141925] border border-[#253040] text-sm rounded-lg font-medium text-gray-300 hover:bg-[#1c2333] transition-colors disabled:opacity-50"
      >
        {adding ? 'Adding...' : '+ Add Prequels'}
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
