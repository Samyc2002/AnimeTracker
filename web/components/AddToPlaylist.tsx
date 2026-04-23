'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Query } from 'appwrite';
import { account, databases, DATABASE_ID, PLAYLISTS_COLLECTION_ID } from '@/lib/appwrite';

interface PlaylistDoc {
  $id: string;
  title: string;
  anime_ids: string;
}

export default function AddToPlaylist({ mediaId }: { mediaId: number }) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const dropWidth = 224;
    let left = rect.right - dropWidth;
    if (left < 8) left = 8;
    if (left + dropWidth > window.innerWidth - 8) left = window.innerWidth - dropWidth - 8;
    setPos({ top: rect.bottom + 4, left });
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    async function load() {
      try {
        const user = await account.get();
        const res = await databases.listDocuments(DATABASE_ID, PLAYLISTS_COLLECTION_ID, [
          Query.equal('user_id', user.$id),
          Query.orderDesc('$createdAt'),
          Query.limit(50),
        ]);
        setPlaylists(res.documents as unknown as PlaylistDoc[]);
      } catch {
        // Not logged in
      }
      setLoaded(true);
    }
    load();
  }, [open, loaded]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function toggleInPlaylist(playlist: PlaylistDoc) {
    const ids: number[] = JSON.parse(playlist.anime_ids || '[]');
    const updated = ids.includes(mediaId)
      ? ids.filter((id) => id !== mediaId)
      : [...ids, mediaId];

    await databases.updateDocument(DATABASE_ID, PLAYLISTS_COLLECTION_ID, playlist.$id, {
      anime_ids: JSON.stringify(updated),
    });

    setPlaylists((prev) =>
      prev.map((p) =>
        p.$id === playlist.$id ? { ...p, anime_ids: JSON.stringify(updated) } : p
      )
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); updatePos(); setOpen(!open); }}
        className="p-1.5 rounded bg-teal-600/20 text-teal-400 hover:bg-teal-600/40 transition-colors"
        title="Add to playlist"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>

      {open && (
        <div
          ref={dropRef}
          className="fixed z-[100] w-56 bg-[#141925] border border-[#253040] rounded-lg shadow-xl overflow-hidden"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-[#253040]">
            <p className="text-xs font-semibold text-gray-400 uppercase">Add to Playlist</p>
          </div>

          {!loaded ? (
            <div className="p-3 text-center">
              <div className="w-4 h-4 border-2 border-[#253040] border-t-teal-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="p-3">
              <p className="text-xs text-gray-500">No playlists yet. Create one in the Playlists tab.</p>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {playlists.map((pl) => {
                const ids: number[] = JSON.parse(pl.anime_ids || '[]');
                const isIn = ids.includes(mediaId);
                return (
                  <button
                    key={pl.$id}
                    onClick={() => toggleInPlaylist(pl)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1c2333] transition-colors"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      isIn ? 'bg-teal-600 border-teal-600' : 'border-[#253040]'
                    }`}>
                      {isIn && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-gray-300 truncate">{pl.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
