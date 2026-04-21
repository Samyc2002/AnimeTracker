import { getAuth } from './auth.js';
import {
  getWatchlistFromAppwrite,
  addToWatchlistAppwrite,
  removeFromWatchlistAppwrite,
  toggleEpisodeWatchedAppwrite,
  getSettingsFromAppwrite,
  updateSettingsAppwrite,
} from './appwrite-storage.js';

const DEFAULTS = {
  watchlist: {},
  lastPollTimestamp: 0,
  airingCache: {},
  notifications: [],
  settings: {
    pollIntervalMinutes: 30,
    notificationsEnabled: true,
    displayLanguage: 'english',
  },
};

async function get(keys) {
  return chrome.storage.local.get(keys);
}

async function set(data) {
  return chrome.storage.local.set(data);
}

export async function init() {
  const existing = await get(Object.keys(DEFAULTS));
  const toSet = {};
  for (const [key, defaultVal] of Object.entries(DEFAULTS)) {
    if (existing[key] === undefined) {
      toSet[key] = defaultVal;
    }
  }
  if (Object.keys(toSet).length > 0) {
    await set(toSet);
  }
}

export async function getWatchlist() {
  const auth = await getAuth();
  console.log('[Anime Tracker] getWatchlist auth:', auth ? 'logged in' : 'local');
  if (auth) {
    try {
      const result = await getWatchlistFromAppwrite(auth);
      console.log('[Anime Tracker] Appwrite watchlist loaded:', Object.keys(result).length, 'entries');
      return result;
    } catch (err) {
      console.error('[Anime Tracker] Appwrite watchlist failed, falling back to local:', err);
    }
  }
  const { watchlist } = await get(['watchlist']);
  return watchlist || {};
}

export async function addToWatchlist(entry) {
  const auth = await getAuth();
  if (auth) {
    try {
      await addToWatchlistAppwrite(auth, entry);
      return;
    } catch {
      // Fall back to local
    }
  }
  const watchlist = await getWatchlist();
  watchlist[entry.mediaId] = entry;
  await set({ watchlist });
}

export async function removeFromWatchlist(mediaId) {
  const auth = await getAuth();
  if (auth) {
    try {
      await removeFromWatchlistAppwrite(auth, mediaId);
      return;
    } catch {
      // Fall back to local
    }
  }
  const watchlist = await getWatchlist();
  delete watchlist[mediaId];
  await set({ watchlist });
}

export async function updateWatchlistEntry(mediaId, updates) {
  const watchlist = await getWatchlist();
  if (watchlist[mediaId]) {
    Object.assign(watchlist[mediaId], updates);
    await set({ watchlist });
  }
}

export async function toggleEpisodeWatched(mediaId, episodeNum) {
  const auth = await getAuth();
  if (auth) {
    try {
      return await toggleEpisodeWatchedAppwrite(auth, mediaId, episodeNum);
    } catch {
      // Fall back to local
    }
  }
  const watchlist = await getWatchlist();
  const entry = watchlist[mediaId];
  if (!entry) return;

  const idx = entry.episodesWatched.indexOf(episodeNum);
  if (idx === -1) {
    entry.episodesWatched.push(episodeNum);
    entry.episodesWatched.sort((a, b) => a - b);
  } else {
    entry.episodesWatched.splice(idx, 1);
  }
  await set({ watchlist });
  return entry.episodesWatched;
}

export async function getSettings() {
  const auth = await getAuth();
  if (auth) {
    try {
      return await getSettingsFromAppwrite(auth);
    } catch {
      // Fall back to local
    }
  }
  const { settings } = await get(['settings']);
  return settings || DEFAULTS.settings;
}

export async function updateSettings(updates) {
  // Always persist poll interval and notifications locally
  const settings = await getSettings();
  Object.assign(settings, updates);
  await set({ settings });

  // Sync display_language to Appwrite if logged in
  const auth = await getAuth();
  if (auth && updates.displayLanguage) {
    try {
      await updateSettingsAppwrite(auth, updates);
    } catch {
      // Non-critical
    }
  }

  return settings;
}

export async function getLastPollTimestamp() {
  const { lastPollTimestamp } = await get(['lastPollTimestamp']);
  return lastPollTimestamp || 0;
}

export async function setLastPollTimestamp(ts) {
  await set({ lastPollTimestamp: ts });
}

export async function getAiringCache() {
  const { airingCache } = await get(['airingCache']);
  return airingCache || {};
}

export async function setAiringCache(cache) {
  await set({ airingCache: cache });
}

const MAX_NOTIFICATIONS = 50;

export async function getNotifications() {
  const { notifications } = await get(['notifications']);
  return notifications || [];
}

export async function addNotification(notification) {
  const notifications = await getNotifications();
  notifications.unshift(notification);
  if (notifications.length > MAX_NOTIFICATIONS) {
    notifications.length = MAX_NOTIFICATIONS;
  }
  await set({ notifications });
}

export async function clearNotifications() {
  await set({ notifications: [] });
}
