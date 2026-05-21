'use client';

import { useTitle } from '@/lib/useTitle';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/lib/auth-context';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { enqueueSnackbar } from 'notistack';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ACHIEVEMENTS_UI_VISIBLE, FOUNDING_MEMBER_ENABLED } from '@/lib/feature-flags';
import { getRandomQuote } from '@/lib/loading-quotes';

interface NotificationDoc {
  id: string;
  media_id: number;
  episode: number;
  title: string;
  cover_url: string;
  airing_at: number;
  is_read: boolean;
  created_at: string;
  type?: string;
}

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function upgradeImageUrl(url: string): string {
  return url.replace(/\/(?:small|medium)\//, '/large/');
}

function NotificationsPage() {
  useTitle('Notifications');
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const { userId } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);

  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState('');
  useEffect(() => { setLoadingQuote(getRandomQuote('general')); }, []);

  const loadNotifications = useCallback(async () => {
    const start = Date.now();
    try {
      if (!userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'episode')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setNotifications((data || []) as NotificationDoc[]);
    } catch {
      // Not authenticated
    }
    const elapsed = Date.now() - start;
    if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
    setLoading(false);
  }, [userId]);

  const pollForNew = useCallback(async () => {
    setPolling(true);
    try {
      if (!userId) throw new Error('Not authenticated');
      await fetch('/api/notifications/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      await loadNotifications();
    } catch {
      // Poll failed
    }
    setPolling(false);
  }, [loadNotifications, userId]);

  useEffect(() => {
    pollForNew();
  }, [pollForNew]);


  async function markAsRead(notif: NotificationDoc) {
    if (notif.is_read) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    setNotifications((prev) =>
      prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n)
    );
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.is_read);
    for (const n of unread) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    enqueueSnackbar('All notifications marked as read', { variant: 'success' });
  }

  async function clearAll() {
    for (const n of notifications) {
      await supabase.from('notifications').delete().eq('id', n.id);
    }
    setNotifications([]);
    enqueueSnackbar('All notifications cleared', { variant: 'success' });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Spinner />
        <p className="text-base text-gray-400 italic mt-2">{loadingQuote}</p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-200">Notifications</h1>
          {unreadCount > 0 && (
            <span className={`px-2 py-0.5 ${theme.activeTab} text-white text-xs font-semibold rounded-full`}>
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {polling && (
            <span className="text-xs text-gray-500 self-center">Checking...</span>
          )}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className={`text-xs ${theme.link} transition-colors`}
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center text-gray-500 mt-12">
          <p>No notifications yet.</p>
          <p className="mt-1 text-sm">Episode alerts and sequel announcements will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.filter((n) => {
            if (n.type !== 'achievement') return true;
            if (ACHIEVEMENTS_UI_VISIBLE) return true;
            if (FOUNDING_MEMBER_ENABLED && n.title.includes('Founding Member')) return true;
            return false;
          }).map((notif) => {
            const notifHref =
              notif.type === 'buddy_request' || notif.type === 'buddy_accept' ? '/buddies'
              : notif.type === 'achievement' ? '/u/me'
              : notif.episode && notif.episode > 0 && notif.media_id ? `/anime/${notif.media_id}?mark_episode=${notif.episode}`
              : notif.media_id ? `/anime/${notif.media_id}`
              : null;
            const cls = `flex gap-3 bg-[#141925] rounded-lg p-3 cursor-pointer hover:bg-[#1c2333] transition-colors ${
              !notif.is_read ? `border-l-2 border-${theme.accent}-500` : ''
            }`;
            const content = (
              <>
              <Image
                src={notif.type === 'achievement' ? notif.cover_url : (upgradeImageUrl(notif.cover_url) || '/placeholder.png')}
                alt=""
                width={48}
                height={notif.type === 'achievement' ? 48 : 68}
                className={`rounded flex-shrink-0 ${notif.type === 'achievement' ? 'object-contain' : 'object-cover'}`}
                unoptimized
              />
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                {notif.type === 'sequel' ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge tone="purple">Sequel</StatusBadge>
                      <p className={`text-sm font-semibold truncate ${notif.is_read ? 'text-gray-400' : 'text-gray-200'}`}>
                        {notif.title}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Upcoming sequel announced &middot; {formatTimeAgo(Math.floor(new Date(notif.created_at).getTime() / 1000))}
                    </p>
                  </>
                ) : notif.type === 'buddy_request' ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge tone="indigo">Buddy Request</StatusBadge>
                      <p className={`text-sm font-semibold truncate ${notif.is_read ? 'text-gray-400' : 'text-gray-200'}`}>
                        {notif.title}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Wants to be your buddy &middot; {formatTimeAgo(Math.floor(new Date(notif.created_at).getTime() / 1000))}
                    </p>
                  </>
                ) : notif.type === 'buddy_accept' ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge tone="emerald">Buddy</StatusBadge>
                      <p className={`text-sm font-semibold truncate ${notif.is_read ? 'text-gray-400' : 'text-gray-200'}`}>
                        {notif.title}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Accepted your buddy request! &middot; {formatTimeAgo(Math.floor(new Date(notif.created_at).getTime() / 1000))}
                    </p>
                  </>
                ) : notif.type === 'buddy_rec' ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge tone="amber">Recommendation</StatusBadge>
                    </div>
                    <p className={`text-sm font-semibold truncate ${notif.is_read ? 'text-gray-400' : 'text-gray-200'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTimeAgo(Math.floor(new Date(notif.created_at).getTime() / 1000))}
                    </p>
                  </>
                ) : notif.type === 'achievement' ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge tone="amber">Achievement</StatusBadge>
                    </div>
                    <p className={`text-sm font-semibold truncate ${notif.is_read ? 'text-gray-400' : 'text-gray-200'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      Unlocked &middot; {formatTimeAgo(Math.floor(new Date(notif.created_at).getTime() / 1000))}
                    </p>
                  </>
                ) : (
                  <>
                    <p className={`text-sm font-semibold ${notif.is_read ? 'text-gray-400' : 'text-gray-200'}`}>
                      Episode {notif.episode} of {notif.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      Aired {formatTimeAgo(notif.airing_at)}
                    </p>
                  </>
                )}
              </div>
              {!notif.is_read && (
                <div className="flex items-center">
                  <span className={`w-2 h-2 ${theme.pulse} rounded-full`} />
                </div>
              )}
            </>
            );
            return notifHref
              ? <Link key={notif.id} href={notifHref} className={cls} onClick={() => markAsRead(notif)}>{content}</Link>
              : <div key={notif.id} className={cls} onClick={() => markAsRead(notif)}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPageGuarded() {
  return <RequireAuth><NotificationsPage /></RequireAuth>;
}
