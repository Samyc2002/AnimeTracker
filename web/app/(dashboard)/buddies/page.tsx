'use client';

import { useTitle } from '@/lib/useTitle';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { enqueueSnackbar } from 'notistack';
import { useAuth } from '@/lib/auth-context';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import RequireAuth from '@/components/RequireAuth';
import type { BuddyProfile } from '@/lib/types';

interface BuddyEntry {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  status: string;
  isSender: boolean;
}

function BuddiesPage() {
  useTitle('Buddies');
  const router = useRouter();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const { userId } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BuddyProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [buddies, setBuddies] = useState<BuddyEntry[]>([]);
  const [pendingReceived, setPendingReceived] = useState<BuddyEntry[]>([]);
  const [pendingSent, setPendingSent] = useState<BuddyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBuddies = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/buddies?userId=${uid}`);
      const data = await res.json();
      setBuddies(data.buddies || []);
      setPendingReceived(data.pendingReceived || []);
      setPendingSent(data.pendingSent || []);
    } catch {
      enqueueSnackbar('Failed to load buddies', { variant: 'error' });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadBuddies(userId);
  }, [loadBuddies, userId]);

  async function handleSearch() {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(
        (data.users || []).filter((u: BuddyProfile) => u.userId !== userId),
      );
    } catch {
      enqueueSnackbar('Search failed', { variant: 'error' });
    }
    setSearching(false);
  }

  async function sendRequest(username: string) {
    if (!userId) return;
    try {
      const res = await fetch('/api/buddies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: userId, receiverUsername: username }),
      });
      const data = await res.json();
      if (!res.ok) {
        enqueueSnackbar(data.error || 'Failed to send request', { variant: 'error' });
        return;
      }
      enqueueSnackbar(`Buddy request sent to ${username}!`, { variant: 'success' });
      setSearchResults([]);
      setSearchQuery('');
      loadBuddies(userId);
    } catch {
      enqueueSnackbar('Failed to send request', { variant: 'error' });
    }
  }

  async function respondToRequest(buddyId: string, action: 'accept' | 'decline') {
    if (!userId) return;
    try {
      await fetch(`/api/buddies/${buddyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId }),
      });
      enqueueSnackbar(action === 'accept' ? 'Buddy added!' : 'Request declined', { variant: 'success' });
      loadBuddies(userId);
    } catch {
      enqueueSnackbar('Failed to respond', { variant: 'error' });
    }
  }

  async function removeBuddy(buddyId: string) {
    if (!userId) return;
    try {
      await fetch(`/api/buddies/${buddyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      enqueueSnackbar('Buddy removed', { variant: 'success' });
      loadBuddies(userId);
    } catch {
      enqueueSnackbar('Failed to remove buddy', { variant: 'error' });
    }
  }

  const allBuddyUserIds = new Set([
    ...buddies.map((b) => b.userId),
    ...pendingReceived.map((b) => b.userId),
    ...pendingSent.map((b) => b.userId),
  ]);

  if (loading) {
    return (
      <div className="flex justify-center mt-12">
        <div className={`w-6 h-6 border-2 border-[#253040] ${theme.spinnerBorder} rounded-full animate-spin`} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-200 mb-4">Buddies</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search users by username..."
          className="flex-1 bg-[#141925] border border-[#253040] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-500"
        />
        <button
          onClick={handleSearch}
          disabled={searchQuery.length < 2 || searching}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${theme.activeTab} text-white disabled:opacity-50`}
        >
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Search Results</h2>
          {searchResults.map((user) => (
            <div key={user.userId} className="flex items-center justify-between bg-[#141925] rounded-lg p-3 border border-[#253040]">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${theme.activeTab} flex items-center justify-center text-white text-sm font-bold`}>
                  {(user.username || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200">{user.displayName || user.username}</p>
                  <p className="text-xs text-gray-500">@{user.username}</p>
                </div>
              </div>
              {allBuddyUserIds.has(user.userId) ? (
                <span className="text-xs text-gray-500">Already connected</span>
              ) : (
                <button
                  onClick={() => sendRequest(user.username)}
                  className={`px-3 py-1 rounded text-xs font-medium ${theme.activeTab} text-white`}
                >
                  Add Buddy
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingReceived.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Pending Requests</h2>
          <div className="space-y-2">
            {pendingReceived.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between bg-[#141925] rounded-lg p-3 border border-[#253040]">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold`}>
                    {(entry.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{entry.displayName || entry.username}</p>
                    <p className="text-xs text-gray-500">wants to be your buddy</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondToRequest(entry.id, 'accept')}
                    className="px-3 py-1 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respondToRequest(entry.id, 'decline')}
                    className="px-3 py-1 rounded text-xs font-medium bg-[#253040] text-gray-300 hover:bg-[#2d3a4d] transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingSent.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Sent Requests</h2>
          <div className="space-y-2">
            {pendingSent.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between bg-[#141925] rounded-lg p-3 border border-[#253040]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#253040] flex items-center justify-center text-gray-400 text-sm font-bold">
                    {(entry.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{entry.displayName || entry.username}</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          My Buddies {buddies.length > 0 && <span className="text-gray-600">({buddies.length})</span>}
        </h2>
        {buddies.length === 0 ? (
          <p className="text-gray-500 text-sm text-center mt-4">
            No buddies yet. Search for friends to start sharing recommendations!
          </p>
        ) : (
          <div className="space-y-2">
            {buddies.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between bg-[#141925] rounded-lg p-3 border border-[#253040] group">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => router.push(`/u/${entry.username}`)}
                >
                  <div className={`w-8 h-8 rounded-full ${theme.activeTab} flex items-center justify-center text-white text-sm font-bold`}>
                    {(entry.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{entry.displayName || entry.username}</p>
                    <p className="text-xs text-gray-500">@{entry.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeBuddy(entry.id)}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BuddiesPageGuarded() {
  return <RequireAuth><BuddiesPage /></RequireAuth>;
}
