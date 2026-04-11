import { fetchAiringSchedule } from '../lib/anilist.js';
import {
  init,
  getWatchlist,
  getSettings,
  getLastPollTimestamp,
  setLastPollTimestamp,
  getAiringCache,
  setAiringCache,
} from '../lib/storage.js';
import { diffAiring } from '../lib/differ.js';

const ALARM_NAME = 'anime-poll';

// --- Install / startup ---
chrome.runtime.onInstalled.addListener(async () => {
  await init();
  const settings = await getSettings();
  await setupAlarm(settings.pollIntervalMinutes);
  // Run an initial poll
  await poll();
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await setupAlarm(settings.pollIntervalMinutes);
});

async function setupAlarm(intervalMinutes) {
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalMinutes });
}

// --- Alarm handler ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await poll();
  }
});

// --- Message handler (from popup) ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'UPDATE_ALARM') {
    setupAlarm(msg.interval).then(() => sendResponse({ ok: true }));
    return true; // async response
  }
});

// --- Polling logic ---
async function poll() {
  try {
    const watchlist = await getWatchlist();
    const mediaIds = Object.keys(watchlist).map(Number);
    if (mediaIds.length === 0) return;

    const settings = await getSettings();
    const lastPoll = await getLastPollTimestamp();
    const now = Math.floor(Date.now() / 1000);

    // If first poll, look back 24 hours
    const from = lastPoll || now - 86400;

    const airingSchedules = await fetchAiringSchedule(mediaIds, from, now);
    const airingCache = await getAiringCache();

    const { newEpisodes, updatedCache } = diffAiring(airingSchedules, airingCache);

    // Send notifications
    if (settings.notificationsEnabled && newEpisodes.length > 0) {
      await notifyNewEpisodes(newEpisodes, watchlist, settings);
    }

    // Update storage
    await setAiringCache(updatedCache);
    await setLastPollTimestamp(now);

    // Update watchlist entries with latest airing info
    for (const schedule of airingSchedules) {
      const entry = watchlist[schedule.mediaId];
      if (entry) {
        entry.nextAiringEpisode = {
          airingAt: schedule.airingAt,
          episode: schedule.episode,
        };
      }
    }
  } catch (err) {
    console.error('[Anime Tracker] Poll error:', err);
  }
}

async function notifyNewEpisodes(newEpisodes, watchlist, settings) {
  const lang = settings.displayLanguage || 'english';

  if (newEpisodes.length > 3) {
    // Batch into single notification
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
      const iconUrl = entry?.coverUrl || '../icons/icon-128.png';

      chrome.notifications.create(`ep-${ep.mediaId}-${ep.episode}`, {
        type: 'basic',
        iconUrl,
        title: 'New Episode Dropped!',
        message: `${title} — Episode ${ep.episode} is now available`,
        priority: 2,
      });
    }
  }
}
