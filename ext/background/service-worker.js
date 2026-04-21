import { fetchAiringSchedule } from '../lib/anilist.js';
import {
  init,
  getWatchlist,
  getSettings,
  getLastPollTimestamp,
  setLastPollTimestamp,
  getAiringCache,
  setAiringCache,
  addNotification,
} from '../lib/storage.js';
import { diffAiring } from '../lib/differ.js';
import { setAuth, clearAuth } from '../lib/auth.js';

const ALARM_NAME = 'anime-poll';

// --- Install / startup ---
chrome.runtime.onInstalled.addListener(() => {
  init().then(async () => {
    const settings = await getSettings();
    await setupAlarm(settings.pollIntervalMinutes);
    console.log('[Anime Tracker] Installed, alarm set for every', settings.pollIntervalMinutes, 'min');
  });
});

chrome.runtime.onStartup.addListener(() => {
  getSettings().then((settings) => setupAlarm(settings.pollIntervalMinutes));
});

async function setupAlarm(intervalMinutes) {
  // Only clear our named alarm, not manually created ones
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (existing) await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalMinutes });
}

// --- Alarm handler ---
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    // Don't use async listener — call poll and let it run
    poll();
  }
});

// --- Message handler (from popup and content script) ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'UPDATE_ALARM') {
    setupAlarm(msg.interval).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'AUTH_JWT') {
    setAuth(msg.jwt, msg.userId).then(() => {
      console.log('[Anime Tracker] JWT received from web app');
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'AUTH_LOGOUT') {
    clearAuth().then(() => {
      console.log('[Anime Tracker] Logged out via web app');
      sendResponse({ ok: true });
    });
    return true;
  }
});

// --- Polling logic ---
async function poll() {
  console.log('[Anime Tracker] Poll started');
  try {
    const watchlist = await getWatchlist();
    const mediaIds = Object.keys(watchlist).map(Number);
    console.log('[Anime Tracker] Media IDs:', mediaIds);
    if (mediaIds.length === 0) {
      console.log('[Anime Tracker] No tracked anime, skipping');
      return;
    }

    const settings = await getSettings();
    const lastPoll = await getLastPollTimestamp();
    const now = Math.floor(Date.now() / 1000);
    const from = lastPoll || now - 86400;
    console.log('[Anime Tracker] Polling window:', new Date(from * 1000), '→', new Date(now * 1000));

    const airingSchedules = await fetchAiringSchedule(mediaIds, from, now);
    console.log('[Anime Tracker] Airing schedules returned:', airingSchedules.length);

    const airingCache = await getAiringCache();
    const { newEpisodes, updatedCache } = diffAiring(airingSchedules, airingCache);
    console.log('[Anime Tracker] New episodes found:', newEpisodes.length, newEpisodes);

    if (settings.notificationsEnabled && newEpisodes.length > 0) {
      await notifyNewEpisodes(newEpisodes, watchlist, settings);
      console.log('[Anime Tracker] Notifications sent');
    }

    await setAiringCache(updatedCache);
    await setLastPollTimestamp(now);
    console.log('[Anime Tracker] Poll complete, timestamp updated to', now);
  } catch (err) {
    console.error('[Anime Tracker] Poll error:', err);
  }
}

async function notifyNewEpisodes(newEpisodes, watchlist, settings) {
  const lang = settings.displayLanguage || 'english';
  const now = Math.floor(Date.now() / 1000);

  for (const ep of newEpisodes) {
    const entry = watchlist[ep.mediaId];
    const title = lang === 'english' && entry?.title?.english ? entry.title.english : entry?.title?.romaji || 'Unknown';

    await addNotification({
      mediaId: ep.mediaId,
      episode: ep.episode,
      airingAt: ep.airingAt,
      title,
      coverUrl: entry?.coverUrl || '',
      timestamp: now,
    });
  }

  if (newEpisodes.length > 3) {
    const titles = newEpisodes
      .map((ep) => {
        const entry = watchlist[ep.mediaId];
        const title = lang === 'english' && entry?.title?.english ? entry.title.english : entry?.title?.romaji || 'Unknown';
        return `${title} Ep ${ep.episode}`;
      })
      .join('\n');

    chrome.notifications.create('ep-batch-' + Date.now(), {
      type: 'basic',
      iconUrl: '../icons/icon-128.png',
      title: `${newEpisodes.length} New Episodes!`,
      message: titles,
      priority: 2,
    });
  } else {
    for (const ep of newEpisodes) {
      const entry = watchlist[ep.mediaId];
      const title = lang === 'english' && entry?.title?.english ? entry.title.english : entry?.title?.romaji || 'Unknown';

      chrome.notifications.create(`ep-${ep.mediaId}-${ep.episode}`, {
        type: 'basic',
        iconUrl: '../icons/icon-128.png',
        title: 'New Episode Dropped!',
        message: `${title} — Episode ${ep.episode} is now available`,
        priority: 2,
      });
    }
  }
}
