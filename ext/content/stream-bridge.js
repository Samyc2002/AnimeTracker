window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'ANIME_STREAM_REQUEST') return;

  const { title, episode, mode } = event.data;

  chrome.runtime.sendMessage(
    { type: 'RESOLVE_STREAM', title, episode, mode },
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
      window.postMessage({
        type: 'ANIME_STREAM_RESPONSE',
        success: response?.success || false,
        sources: response?.sources || [],
        error: response?.error || null,
      });
    }
  );
});

window.postMessage({ type: 'ANIME_EXTENSION_READY' });
