# Anime Tracker

A Chrome extension that lets you maintain an anime watchlist, track watched episodes, and receive notifications when new episodes drop.

Data is sourced from the [AniList GraphQL API](https://anilist.gitbook.io/anilist-apiv2-docs) and stored locally in Chrome storage — no backend, no accounts required.

## Features

- **Search & add anime** — search AniList's database and add series to your watchlist with one click
- **Episode tracking** — click-to-toggle episode grid to mark what you've watched
- **New episode notifications** — background polling detects newly aired episodes and sends native OS notifications
- **Configurable settings** — poll interval (15/30/60 min), notification toggle, title language (English/Romaji)
- **AniList import** — import your existing AniList watchlist via OAuth (requires client ID setup)

## Install

1. Clone this repo
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `anime-tracker` folder

## Project Structure

```
anime-tracker/
├── manifest.json              # Chrome MV3 manifest
├── popup/
│   ├── index.html             # Popup entry point
│   ├── popup.js               # UI logic (vanilla JS, ES modules)
│   └── popup.css              # Dark theme styles
├── background/
│   └── service-worker.js      # Polling + notification dispatch
├── lib/
│   ├── anilist.js             # AniList GraphQL client
│   ├── storage.js             # chrome.storage.local abstraction
│   └── differ.js              # Episode diff engine
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## How It Works

1. **Search** — type in the search bar, results come from AniList's `Media` query
2. **Track** — added anime are persisted in `chrome.storage.local` as watchlist entries
3. **Poll** — a service worker wakes up via `chrome.alarms` (default: every 30 min), queries AniList for newly aired episodes, and diffs against cached state
4. **Notify** — new episodes trigger native Chrome notifications (batched if >3 fire at once)
5. **Mark watched** — click episode numbers in the grid to toggle watched state

## AniList API

All data comes from the [AniList GraphQL API](https://graphql.anilist.co). Public queries (search, airing schedules) require no authentication. Importing a user's personal list requires OAuth2 authorization.

Rate limit: 90 requests/minute. The extension's polling strategy stays well under this.

## License

MIT
