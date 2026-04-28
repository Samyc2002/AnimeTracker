'use client';

import { useState, useRef, useEffect } from 'react';
import { ID, Query } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID } from '@/lib/appwrite';
import { mediaToWatchlistEntry, getErrorMessage } from '@/lib/anilist';
import { enqueueSnackbar } from 'notistack';
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
      const user = await account.get();

      if (added && docId) {
        await databases.updateDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, docId, {
          watch_status: status,
        });
      } else {
        const entry = mediaToWatchlistEntry(media);
        const doc = await databases.createDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, ID.unique(), {
          ...entry,
          user_id: user.$id,
          watch_status: status,
        });
        setDocId(doc.$id);
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
      const user = await account.get();
      const res = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.equal('media_id', media.id),
        Query.limit(1),
      ]);
      if (res.documents.length > 0) {
        setAdded(true);
        setDocId(res.documents[0].$id);
        const ws = (res.documents[0] as unknown as { watch_status?: string }).watch_status;
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
          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          {updating ? '...' : '+ Add'}
        </button>
        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 z-[100] w-40 bg-[#141925] border border-[#253040] rounded-lg shadow-xl overflow-hidden">
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
