const STORAGE_KEY = 'anime_tracker_ext_jwt';
const POLL_INTERVAL_MS = 5000;

function getExtensionId() {
  try {
    return chrome.runtime?.id;
  } catch {
    return null;
  }
}

function sendAuth(data) {
  if (!getExtensionId()) return;
  try {
    chrome.runtime.sendMessage(data);
  } catch {
    // Extension context invalidated
  }
}

function checkAndForward() {
  const raw = localStorage.getItem(STORAGE_KEY);
  console.log('[Anime Tracker Bridge] Checking JWT:', raw ? 'found' : 'not found');
  if (raw) {
    try {
      const { jwt, userId } = JSON.parse(raw);
      if (jwt && userId) {
        console.log('[Anime Tracker Bridge] Sending JWT to extension for user:', userId);
        sendAuth({ type: 'AUTH_JWT', jwt, userId });
      }
    } catch (err) {
      console.error('[Anime Tracker Bridge] Malformed JWT data:', err);
    }
  } else {
    sendAuth({ type: 'AUTH_LOGOUT' });
  }
}

checkAndForward();

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) checkAndForward();
});

setInterval(checkAndForward, POLL_INTERVAL_MS);
