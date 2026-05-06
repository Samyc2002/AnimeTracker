'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { mediaToWatchlistEntry, getErrorMessage } from '@/lib/anime-provider';
import { enqueueSnackbar } from 'notistack';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { backfillSeriesId } from '@/lib/series-resolver';
import type { AniListMedia } from '@/lib/types';
import type { WatchStatus } from '@/lib/types';

const STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];

const statusColors: Record<WatchStatus, string> = {
  Watching: 'text-emerald-400',
  Planned: 'text-blue-400',
  Completed: 'text-purple-400',
  Dropped: 'text-red-400',
};

export default function AddToWatchlist({ media }: { media: AniListMedia }) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [added, setAdded] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<WatchStatus>('Watching');
  const [showDropdown, setShowDropdown] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false);
    }
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  async function handleAdd(status: WatchStatus) {
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      if (added && docId) {
        const { error } = await supabase
          .from('watchlist_entries')
          .update({ watch_status: status })
          .eq('id', docId);
        if (error) throw error;
      } else {
        const entry = mediaToWatchlistEntry(media);
        const { data: doc, error } = await supabase
          .from('watchlist_entries')
          .insert({
            ...entry,
            user_id: user.id,
            watch_status: status,
          })
          .select()
          .single();
        if (error) throw error;
        setDocId(doc.id);
        backfillSeriesId(doc.id, media.id, async (id, data) => {
          await supabase.from('watchlist_entries').update(data).eq('id', id);
        }).catch(() => {});
      }

      const wasAdded = added;
      setAdded(true);
      setCurrentStatus(status);
      setShowDropdown(false);
      enqueueSnackbar(wasAdded ? `Status changed to ${status}` : `Added as ${status}`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
    setUpdating(false);
  }

  async function checkIfAdded() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data } = await supabase
        .from('watchlist_entries')
        .select()
        .eq('user_id', user.id)
        .eq('media_id', media.id)
        .limit(1);

      if ((!data || data.length === 0) && media.idMal) {
        const res = await supabase
          .from('watchlist_entries')
          .select()
          .eq('user_id', user.id)
          .eq('id_mal', media.idMal)
          .limit(1);
        data = res.data;
      }

      if (data && data.length > 0) {
        setAdded(true);
        setDocId(data[0].id);
        const ws = data[0].watch_status as string | undefined;
        if (ws) setCurrentStatus(ws as WatchStatus);
      }
    } catch {
      // Not logged in
    }
  }

  useEffect(() => {
    checkIfAdded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.id]);

  if (!added) {
    return (
      <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={updating}
          className={`px-3 py-1.5 ${theme.btn} text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors`}
        >
          {updating ? '...' : '+ Add'}
        </button>
        {showDropdown && (
          <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-[100] w-40 bg-[#141925] border border-[#253040] rounded-lg shadow-xl overflow-hidden">
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

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={updating}
        className={`px-3 py-1.5 bg-[#141925] border border-[#253040] text-sm rounded-lg font-medium transition-colors hover:bg-[#1c2333] ${statusColors[currentStatus]}`}
      >
        {updating ? '...' : currentStatus}
      </button>
      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 z-[100] w-40 bg-[#141925] border border-[#253040] rounded-lg shadow-xl overflow-hidden">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => handleAdd(s)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[#1c2333] transition-colors ${
                currentStatus === s ? statusColors[s] : 'text-gray-300'
              }`}
            >
              {currentStatus === s ? '● ' : '○ '}{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
