'use client';

import { useState } from 'react';
import { fetchAnimeDetail } from '@/lib/anime-provider';
import { searchJikan } from '@/lib/providers/jikan';
import { saveAnimeToCache } from '@/lib/providers/cache';
import { enqueueSnackbar } from 'notistack';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DatabaseSeed() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [stats, setStats] = useState<{ saved: number; skipped: number; errors: number } | null>(null);

  async function seedTopAnime() {
    setRunning(true);
    setStats(null);
    const result = { saved: 0, skipped: 0, errors: 0 };

    try {
      setProgress('Fetching top anime from Jikan...');

      const pages = [1, 2, 3, 4, 5, 6, 7, 8];
      const allIds: number[] = [];

      for (const page of pages) {
        setProgress(`Fetching top anime page ${page}/${pages.length}...`);
        try {
          const res = await fetch(`https://api.jikan.moe/v4/top/anime?page=${page}&limit=25`);
          if (!res.ok) break;
          const data = await res.json();
          for (const item of data.data || []) {
            allIds.push(item.mal_id);
          }
          await delay(1000);
        } catch {
          break;
        }
      }

      setProgress(`Fetching currently airing anime...`);
      try {
        const airingRes = await fetch('https://api.jikan.moe/v4/top/anime?filter=airing&limit=25');
        if (airingRes.ok) {
          const airingData = await airingRes.json();
          for (const item of airingData.data || []) {
            if (!allIds.includes(item.mal_id)) allIds.push(item.mal_id);
          }
        }
        await delay(1000);
      } catch { /* skip */ }

      setProgress(`Processing ${allIds.length} anime...`);

      for (let i = 0; i < allIds.length; i++) {
        setProgress(`Caching anime ${i + 1}/${allIds.length}...`);
        try {
          const detail = await fetchAnimeDetail(allIds[i]);
          if (detail) {
            await saveAnimeToCache(detail);
            result.saved++;
          } else {
            result.skipped++;
          }
        } catch {
          result.errors++;
        }
        await delay(300);
      }

      setStats(result);
      setProgress('');
      enqueueSnackbar(`Seeded ${result.saved} anime into local database`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(`Seed failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { variant: 'error' });
    }
    setRunning(false);
  }

  return (
    <div className="border-t border-[#253040] pt-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Database Seed</h2>
      <p className="text-xs text-gray-600 mb-3">
        Populate your local anime database with the top 200 most popular anime and all currently airing shows.
        This makes search and detail pages load faster and work when external providers are down.
      </p>

      {stats && (
        <div className="mb-3 px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-xs text-gray-400 space-y-1">
          <p>Anime cached: <span className="text-teal-400">{stats.saved}</span></p>
          <p>Already cached: <span className="text-gray-500">{stats.skipped}</span></p>
          {stats.errors > 0 && <p>Errors: <span className="text-red-400">{stats.errors}</span></p>}
        </div>
      )}

      {progress && (
        <p className="text-xs text-gray-500 mb-3">{progress}</p>
      )}

      <button
        onClick={seedTopAnime}
        disabled={running}
        className="px-4 py-2 bg-[#141925] hover:bg-[#1c2333] text-gray-300 text-sm rounded-lg border border-[#253040] transition-colors disabled:opacity-50"
      >
        {running ? 'Seeding...' : 'Seed Database'}
      </button>
    </div>
  );
}
