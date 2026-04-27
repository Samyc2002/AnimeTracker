import { getStreamSources, setProxyBase } from '../lib/animekai.js';

export function handleStreamMessage(message, _sender, sendResponse) {
  if (message.type !== 'RESOLVE_STREAM') return false;

  const { title, episode, mode, appOrigin } = message;

  if (appOrigin) setProxyBase(appOrigin);

  getStreamSources(title, episode, mode || 'sub')
    .then((sources) => {
      sendResponse({ success: true, sources });
    })
    .catch((err) => {
      console.error('[Anime Tracker] Stream resolution failed:', err.message);
      sendResponse({ success: false, sources: [], error: err.message });
    });

  return true;
}
