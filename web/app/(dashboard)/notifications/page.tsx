'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Query } from 'appwrite';
import { account, databases, DATABASE_ID, NOTIFICATIONS_COLLECTION_ID } from '@/lib/appwrite';
import Image from 'next/image';
import RequireAuth from '@/components/RequireAuth';

interface NotificationDoc {
  $id: string;
  media_id: number;
  episode: number;
  title: string;
  cover_url: string;
  airing_at: number;
  is_read: boolean;
  created_at: string;
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
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const user = await account.get();
      const res = await databases.listDocuments(DATABASE_ID, NOTIFICATIONS_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.orderDesc('airing_at'),
        Query.limit(100),
      ]);
      setNotifications(res.documents as unknown as NotificationDoc[]);
    } catch {
      // Not authenticated
    }
    setLoading(false);
  }, []);

  const pollForNew = useCallback(async () => {
    setPolling(true);
    try {
      const user = await account.get();
      await fetch('/api/notifications/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.$id }),
      });
      await loadNotifications();
    } catch {
      // Poll failed
    }
    setPolling(false);
  }, [loadNotifications]);

  useEffect(() => {
    pollForNew();
  }, [pollForNew]);

  async function markAsRead(notif: NotificationDoc) {
    if (notif.is_read) return;
    await databases.updateDocument(DATABASE_ID, NOTIFICATIONS_COLLECTION_ID, notif.$id, {
      is_read: true,
    });
    setNotifications((prev) =>
      prev.map((n) => n.$id === notif.$id ? { ...n, is_read: true } : n)
    );
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.is_read);
    for (const n of unread) {
      await databases.updateDocument(DATABASE_ID, NOTIFICATIONS_COLLECTION_ID, n.$id, {
        is_read: true,
      });
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function clearAll() {
    for (const n of notifications) {
      await databases.deleteDocument(DATABASE_ID, NOTIFICATIONS_COLLECTION_ID, n.$id);
    }
    setNotifications([]);
  }

  if (loading) {
    return (
      <div className="flex justify-center mt-12">
        <div className="w-6 h-6 border-2 border-[#253040] border-t-teal-500 rounded-full animate-spin" />
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
            <span className="px-2 py-0.5 bg-teal-600 text-white text-xs font-semibold rounded-full">
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
              className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
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
          <p className="mt-1 text-sm">New episode alerts will appear here for anime in your watchlist.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.$id}
              className={`flex gap-3 bg-[#141925] rounded-lg p-3 cursor-pointer hover:bg-[#1c2333] transition-colors ${
                !notif.is_read ? 'border-l-2 border-teal-500' : ''
              }`}
              onClick={() => {
                markAsRead(notif);
                router.push(`/anime/${notif.media_id}`);
              }}
            >
              <Image
                src={upgradeImageUrl(notif.cover_url) || '/icon-128.png'}
                alt=""
                width={48}
                height={68}
                className="rounded object-cover flex-shrink-0"
                unoptimized
              />
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <p className={`text-sm font-semibold ${notif.is_read ? 'text-gray-400' : 'text-gray-200'}`}>
                  Episode {notif.episode} of {notif.title}
                </p>
                <p className="text-xs text-gray-500">
                  Aired {formatTimeAgo(notif.airing_at)}
                </p>
              </div>
              {!notif.is_read && (
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-teal-400 rounded-full" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPageGuarded() {
  return <RequireAuth><NotificationsPage /></RequireAuth>;
}
