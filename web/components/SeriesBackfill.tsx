'use client';

import { useState } from 'react';
import { Query } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID } from '@/lib/appwrite';
import { getSeriesId } from '@/lib/series-resolver';
import { enqueueSnackbar } from 'notistack';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SeriesBackfill() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [stats, setStats] = useState<{ updated: number; skipped: number; errors: number } | null>(null);

  async function runBackfill() {
    setRunning(true);
    setStats(null);
    const result = { updated: 0, skipped: 0, errors: 0 };

    try {
      const user = await account.get();
      setProgress('Fetching watchlist...');

      const res = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.limit(500),
      ]);

      const entries = res.documents as unknown as { $id: string; media_id: number; series_id?: number | null }[];
      const needsBackfill = entries.filter((e) => !e.series_id);

      setProgress(`Resolving series for ${needsBackfill.length} entries...`);

      for (let i = 0; i < needsBackfill.length; i++) {
        const entry = needsBackfill[i];
        setProgress(`Resolving ${i + 1}/${needsBackfill.length}...`);
        try {
          const seriesId = await getSeriesId(entry.media_id);
          await databases.updateDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, entry.$id, {
            series_id: seriesId,
          });
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
