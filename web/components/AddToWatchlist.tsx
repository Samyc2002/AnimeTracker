'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { mediaToWatchlistEntry, getErrorMessage } from '@/lib/anime-provider';
import { enqueueSnackbar } from 'notistack';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { backfillSeriesId } from '@/lib/series-resolver';
import { fireClientAchievementEvent } from '@/lib/achievements/fire-event';
import type { AniListMedia } from '@/lib/types';
import type { WatchStatus } from '@/lib/types';

const STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];

const statusColors: Record<WatchStatus, string> = {
  Watching: 'text-emerald-400',
  Planned: 'text-blue-400',
  Completed: 'text-purple-400',
  Dropped: 'text-red-400',
};

const dropdownMotion = {
  initial: { opacity: 0, scale: 0.95, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4 },
  transition: { duration: 0.15, ease: 'easeOut' as const },
};

export default function AddToWatchlist({ media }: { media: AniListMedia }) {
  const { userId } = useAuth();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [added, setAdded] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<WatchStatus>('Watching');
  const [showDropdown, setShowDropdown] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false);
    }
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  async function handleAdd(status: WatchStatus) {
    if (updating) return;
    setUpdating(true);
    setShowDropdown(false);
    try {
      if (!userId) throw new Error('Not logged in');

      if (added && docId) {
        const { error } = await supabase
          .from('watchlist_entries')
          .update({ watch_status: status })
          .eq('id', docId);
        if (error) throw error;
        setCurrentStatus(status);
        enqueueSnackbar(`Status changed to ${status}`, { variant: 'success' });
        fireClientAchievementEvent(userId, 'status_change');
      } else {
        const entry = mediaToWatchlistEntry(media);
        const { data: doc, error } = await supabase
          .from('watchlist_entries')
          .insert({
            ...entry,
            user_id: userId,
            watch_status: status,
          })
          .select()
          .single();
        if (error) throw error;
        setDocId(doc.id);
        setAdded(true);
        setCurrentStatus(status);
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 600);
        enqueueSnackbar(`Added as ${status}`, { variant: 'success' });
        fireClientAchievementEvent(userId, 'watchlist_add');
        backfillSeriesId(doc.id, media.id, async (id, data) => {
          await supabase.from('watchlist_entries').update(data).eq('id', id);
        }).catch(() => {});
      }
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err), { variant: 'error' });
    }
    setUpdating(false);
  }

  async function checkIfAdded() {
    try {
      if (!userId) return;

      let { data } = await supabase
        .from('watchlist_entries')
        .select()
        .eq('user_id', userId)
        .eq('media_id', media.id)
        .limit(1);

      if ((!data || data.length === 0) && media.idMal) {
        const res = await supabase
          .from('watchlist_entries')
          .select()
          .eq('user_id', userId)
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
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              {...dropdownMotion}
              className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-[100] w-40 bg-[#141925] border border-[#253040] rounded-lg shadow-xl overflow-hidden"
            >
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleAdd(s)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#1c2333] transition-colors"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative ${justAdded ? 'animate-watchlist-burst' : ''}`} onClick={(e) => e.stopPropagation()}>
      <motion.button
        key={String(added)}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={updating}
        className={`px-3 py-1.5 bg-[#141925] border border-[#253040] text-sm rounded-lg font-medium transition-colors hover:bg-[#1c2333] ${statusColors[currentStatus]}`}
      >
        {updating ? '...' : currentStatus}
      </motion.button>
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            {...dropdownMotion}
            className="absolute right-0 top-full mt-1 z-[100] w-40 bg-[#141925] border border-[#253040] rounded-lg shadow-xl overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
