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

// --- Stream bridge ---
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'ANIME_STREAM_REQUEST') return;

  const { title, episode, mode } = event.data;
  console.log('[Anime Tracker Bridge] Stream request received:', { title, episode, mode });

  try {
    chrome.runtime.sendMessage(
      { type: 'RESOLVE_STREAM', title, episode, mode, appOrigin: window.location.origin },
      (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage({
            type: 'ANIME_STREAM_RESPONSE',
            success: false,
            sources: [],
            error: chrome.runtime.lastError.message,
          });
          return;
        }
        console.log('[Anime Tracker Bridge] Stream response from background:', response);
        window.postMessage({
          type: 'ANIME_STREAM_RESPONSE',
          success: response?.success || false,
          sources: response?.sources || [],
          error: response?.error || null,
        });
      }
    );
  } catch {
    // Extension context invalidated
  }
});

window.postMessage({ type: 'ANIME_EXTENSION_READY' });
