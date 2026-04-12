# Anime Tracker — Chrome Extension

## Project overview

Chrome extension (Manifest V3) for tracking anime watchlists with episode notifications. Vanilla JS, no build step, no framework. Data from AniList GraphQL API, stored in `chrome.storage.local`.

## Architecture

- See `ARCHITECTURE.md` for the full design doc including data model, API queries, and key flows
- **popup/** — UI layer (HTML/CSS/JS), 5 views: notifications (default), watchlist, search, episode detail, settings
- **background/** — service worker for polling AniList airing schedules and dispatching notifications via `chrome.alarms`
- **lib/** — shared modules: `anilist.js` (GraphQL client), `storage.js` (chrome.storage abstraction), `differ.js` (episode diff engine)
- All JS uses ES modules (`import`/`export`)

## Key technical details

- **No build step** — plain JS loaded directly by Chrome, no bundler
- **Manifest V3** — service workers are ephemeral (wake on events, die after ~30s idle). All state must be in `chrome.storage`, never in-memory globals. The service worker must declare `"type": "module"` in the manifest to use ES module imports
- **AniList API** — GraphQL endpoint at `https://graphql.anilist.co`, no API key needed for public queries. Rate limit: 90 req/min
- **Notifications** — batched into a single notification if >3 episodes drop at once to avoid Chrome throttling. Notification icons must use local paths (AniList CDN blocks CORS from extension origins). Notification history is persisted in storage and displayed in the popup
- **Service worker polling** — does NOT run an initial poll on install (to avoid consuming the polling window). First poll happens when the alarm fires. Console logs prefixed with `[Anime Tracker]` for debugging

## Storage schema

Watchlist entries keyed by `mediaId` (AniList media ID). Each entry has: `title`, `coverUrl`, `status`, `totalEpisodes`, `nextAiringEpisode`, `episodesWatched` (array of episode numbers), `addedAt`.

Notification history stored as `notifications` array (newest first, capped at 50). Each entry has: `mediaId`, `episode`, `airingAt`, `title`, `coverUrl`, `timestamp`.

Full schema in `ARCHITECTURE.md`.

## Code conventions

- Vanilla JS, no TypeScript, no framework
- ES module imports throughout (both popup and service worker)
- Functions are async where they touch `chrome.storage` or `fetch`
- No external dependencies — everything is self-contained

## Known issues / decisions

- **AniList OAuth import removed from MVP** — AniList's OAuth doesn't work with `chrome.identity.launchWebAuthFlow` (`chromiumapp.org` redirect URLs not supported). The code for `fetchViewer` and `fetchUserList` exists in `anilist.js` for future use
- **Cover images in notifications** — `chrome.notifications.create()` can't use AniList CDN URLs (CORS blocked), so OS notifications use the local extension icon. The popup notifications view uses `<img>` tags which aren't subject to CORS, with an `onerror` fallback to the local icon

## Testing

No test framework currently. To test manually:
1. Load unpacked at `chrome://extensions/`
2. Click the extension icon to open the popup
3. Search for an anime, add it, toggle episodes
4. Check `chrome://extensions/` → service worker "Inspect" for background logs

To test polling/notifications:
```js
// In service worker console — reset and trigger a poll
chrome.storage.local.set({ lastPollTimestamp: 0, airingCache: {}, notifications: [] }, () => {
  chrome.alarms.create('anime-poll', { delayInMinutes: 0.08 });
});
```
