const DEFAULTS = {
  watchlist: {},
  lastPollTimestamp: 0,
  airingCache: {},
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
  const { watchlist } = await get(['watchlist']);
  return watchlist || {};
}

export async function addToWatchlist(entry) {
  const watchlist = await getWatchlist();
  watchlist[entry.mediaId] = entry;
  await set({ watchlist });
}

export async function removeFromWatchlist(mediaId) {
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
  const { settings } = await get(['settings']);
  return settings || DEFAULTS.settings;
}

export async function updateSettings(updates) {
  const settings = await getSettings();
  Object.assign(settings, updates);
  await set({ settings });
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
