'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { enqueueSnackbar } from 'notistack';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';

interface BuddyEntry {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
}

interface Props {
  mediaId: number;
  title: string;
  coverUrl: string;
}

export default function RecommendToBuddy({ mediaId, title, coverUrl }: Props) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [open, setOpen] = useState(false);
  const [buddies, setBuddies] = useState<BuddyEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const res = await fetch(`/api/buddies?userId=${user.id}`);
        const data = await res.json();
        setBuddies(data.buddies || []);
      } catch {
        enqueueSnackbar('Failed to load buddies', { variant: 'error' });
      }
      setLoading(false);
    }
    load();
  }, [open]);

  async function send(buddy: BuddyEntry) {
    setSending(buddy.userId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      const res = await fetch('/api/buddy-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          toUserId: buddy.userId,
          mediaId,
          title,
          coverUrl,
          message: message || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        enqueueSnackbar(data.error || 'Failed to send', { variant: 'error' });
      } else {
        enqueueSnackbar(`Recommended to ${buddy.displayName || buddy.username}!`, { variant: 'success' });
        setOpen(false);
        setMessage('');
      }
    } catch {
      enqueueSnackbar('Failed to send recommendation', { variant: 'error' });
    }
    setSending(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg bg-[#141925] border border-[#253040] hover:bg-[#1c2333] transition-colors text-gray-400 hover:text-gray-200"
        title="Recommend to buddy"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
            <div className="bg-[#141925] rounded-t-2xl border-t border-x border-[#253040] max-h-[60vh] flex flex-col mx-auto max-w-md">
              <div className="flex items-center justify-between p-4 border-b border-[#253040] flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">Recommend to Buddy</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[250px]">{title}</p>
                </div>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-[#253040] transition-colors text-gray-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="p-3 border-b border-[#253040]">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 140))}
                  placeholder="Add a note (optional)"
                  className="w-full bg-[#0b0e14] border border-[#253040] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading ? (
                  <div className="flex justify-center py-4">
                    <div className={`w-5 h-5 border-2 border-[#253040] ${theme.spinnerBorder} rounded-full animate-spin`} />
                  </div>
                ) : buddies.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-4">
                    No buddies yet. <a href="/buddies" className={`${theme.link}`}>Add some!</a>
                  </p>
                ) : (
                  buddies.map((buddy) => (
                    <div key={buddy.userId} className="flex items-center justify-between bg-[#0b0e14] rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${theme.activeTab} flex items-center justify-center text-white text-xs font-bold`}>
                          {(buddy.username || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-200">{buddy.displayName || buddy.username}</p>
                          <p className="text-xs text-gray-500">@{buddy.username}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => send(buddy)}
                        disabled={sending === buddy.userId}
                        className={`px-3 py-1.5 rounded text-xs font-medium ${theme.activeTab} text-white disabled:opacity-50`}
                      >
                        {sending === buddy.userId ? '...' : 'Send'}
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-3 mt-1" />
            </div>
          </div>
        </>
      )}
    </>
  );
}
