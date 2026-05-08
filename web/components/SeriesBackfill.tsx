'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getSeriesId } from '@/lib/series-resolver';
import { enqueueSnackbar } from 'notistack';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SeriesBackfill() {
  const { userId } = useAuth();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [stats, setStats] = useState<{ updated: number; skipped: number; errors: number } | null>(null);

  async function runBackfill() {
    setRunning(true);
    setStats(null);
    const result = { updated: 0, skipped: 0, errors: 0 };

    try {
      if (!userId) throw new Error('Not logged in');
      setProgress('Fetching watchlist...');

      const allDocs: { id: string; media_id: number; series_id?: number | null }[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase
          .from('watchlist_entries')
          .select('id, media_id, series_id')
          .eq('user_id', userId)
          .range(offset, offset + 99);
        const rows = data || [];
        allDocs.push(...rows);
        offset += 100;
        hasMore = rows.length === 100;
      }

      const entries = allDocs;

      setProgress(`Resolving series for ${entries.length} entries...`);

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        setProgress(`Resolving ${i + 1}/${entries.length}...`);
        try {
          const seriesId = await getSeriesId(entry.media_id);
          await supabase
            .from('watchlist_entries')
            .update({ series_id: seriesId })
            .eq('id', entry.id);
          result.updated++;
        } catch {
          result.errors++;
        }
        await delay(300);
      }

      setStats(result);
      setProgress('');
      enqueueSnackbar(`Backfilled series IDs for ${result.updated} entries`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(`Backfill failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { variant: 'error' });
    }
    setRunning(false);
  }

  return (
    <div className="border-t border-[#253040] pt-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Series Grouping</h2>
      <p className="text-xs text-gray-600 mb-3">
        Link related anime seasons together so they group into folders in your watchlist.
        This resolves the prequel chain for each entry to find the root series.
      </p>

      {stats && (
        <div className="mb-3 px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-xs text-gray-400 space-y-1">
          <p>Updated: <span className="text-teal-400">{stats.updated}</span></p>
          <p>Already linked: <span className="text-gray-500">{stats.skipped}</span></p>
          {stats.errors > 0 && <p>Errors: <span className="text-red-400">{stats.errors}</span></p>}
        </div>
      )}

      {progress && <p className="text-xs text-gray-500 mb-3">{progress}</p>}

      <button
        onClick={runBackfill}
        disabled={running}
        className="px-4 py-2 bg-[#141925] hover:bg-[#1c2333] text-gray-300 text-sm rounded-lg border border-[#253040] transition-colors disabled:opacity-50"
      >
        {running ? 'Running...' : 'Link Series'}
      </button>
    </div>
  );
}
