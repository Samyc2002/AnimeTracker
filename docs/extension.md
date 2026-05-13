# Chrome Extension Guide

The extension lives in `ext/` and is a Manifest V3 Chrome extension built with vanilla JavaScript. It has **no build step** -- plain JS files are loaded directly by Chrome.

## Overview

- **Manifest V3** with ES module service worker
- **Vanilla JS** -- no TypeScript, no framework, no bundler
- **ES modules** throughout (`import`/`export`)
- **No external dependencies**

## File Structure

```
ext/
  manifest.json          # Extension manifest (permissions, service worker, content scripts)
  popup/
    popup.html           # Main popup UI
    popup.css            # Styles (dark theme matching web app)
    popup.js             # Entry point, view routing
    views/
      notifications.js   # Notification feed (default view)
      watchlist.js       # User's watchlist
      search.js          # Anime search
      episode-detail.js  # Episode tracking grid
      settings.js        # Extension settings
  background/
    service-worker.js    # Poll loop, episode diff, notification dispatch
  lib/
    anilist.js           # AniList GraphQL client
    storage.js           # Dual-backend: chrome.storage + Appwrite
    differ.js            # Episode diff engine (detects new episodes)
    auth.js              # JWT management
    appwrite-client.js   # Raw Appwrite REST wrapper
    appwrite-storage.js  # Appwrite-backed storage operations
    config.js            # Gitignored -- API keys and endpoints
    config.example.js    # Template for config.js
    transforms.js        # Data shape conversion between backends
  content/
    bridge.js            # Injected on animetracker.lol -- forwards JWT to extension
  icons/                 # Extension icons (16, 32, 48, 128px)
```

## Key Constraints

- **Service workers are ephemeral**: They can be terminated by Chrome at any time (~30s of inactivity). All state must live in `chrome.storage`, never in in-memory globals.
- **`"type": "module"`** must be declared in `manifest.json` for ES module service workers.
- **Dynamic `import()` is banned** in service workers -- use static imports at the top of the file.
- **No shared packages with `web/`**: The extension has no build step, so AniList queries are copied/ported from the web app, not shared.
- **AniList CDN blocks CORS** for `chrome.notifications.create()` -- OS notifications must use a local icon. Popup `<img>` tags work fine.
- **AniList OAuth doesn't work** in extensions (chromiumapp.org redirect not supported). The extension uses a JWT bridge instead.

## How Polling Works

1. `chrome.alarms` fires periodically
2. Service worker wakes up, queries AniList for airing schedules
3. `differ.js` compares new data against stored cache
4. New episodes trigger `chrome.notifications.create()` with local icon
5. Notification history is persisted to `chrome.storage` (50-item cap)
6. Notifications are batched if more than 3 fire at once

## Development

### Load the extension

1. Copy `ext/lib/config.example.js` to `ext/lib/config.js` and fill in values
2. Open `chrome://extensions`
3. Enable **Developer Mode**
4. Click **Load unpacked**, select `ext/`

### Test polling manually

Open the extension's service worker console (click "Inspect views: service worker" on the extensions page) and run:

```js
chrome.storage.local.set(
  { lastPollTimestamp: 0, airingCache: {}, notifications: [] },
  () => chrome.alarms.create('anime-poll', { delayInMinutes: 0.08 })
);
```

This resets the poll state and triggers a poll in ~5 seconds.

### Logging

All service worker logs are prefixed with `[Anime Tracker]` for easy filtering in the console.

## Color Scheme

Matches the web app: deep navy `#0b0e14` background with teal accents.

## See Also

- [ARCHITECTURE.md](../ARCHITECTURE.md) (repo root) -- the full extension design document with data model, query details, and flow diagrams
- [Architecture Overview](architecture.md) -- whole-system view
