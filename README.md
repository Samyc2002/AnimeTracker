# Anime Tracker

A Chrome extension that lets you maintain an anime watchlist, track watched episodes, and receive notifications when new episodes drop.

Data is sourced from the [AniList GraphQL API](https://anilist.gitbook.io/anilist-apiv2-docs) and stored locally in Chrome storage — no backend, no accounts required.

## Features

- **Notification feed** — see all new episode alerts in the popup, highlighted if unwatched; click to mark as watched
- **Search & add anime** — search AniList's database and add series to your watchlist with one click
- **Episode tracking** — click-to-toggle episode grid to mark what you've watched
- **New episode notifications** — background polling detects newly aired episodes and sends native OS notifications
- **Configurable settings** — poll interval (15/30/60 min), notification toggle, title language (English/Romaji)

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
│   ├── index.html             # Popup entry point (5 views)
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
4. **Notify** — new episodes trigger native Chrome notifications (batched if >3 fire at once) and are saved to the notification feed
5. **Mark watched** — click an unwatched notification to mark it as watched, or use the episode grid from the watchlist

## AniList API

All data comes from the [AniList GraphQL API](https://graphql.anilist.co). No authentication required — all queries are public.

Rate limit: 90 requests/minute. The extension's polling strategy stays well under this.

## Publishing to Chrome Web Store

1. Replace placeholder icons in `icons/` with proper artwork
2. Zip the extension: `zip -r anime-tracker.zip . -x ".*" -x "ARCHITECTURE.md" -x "CLAUDE.md" -x "README.md"`
3. Create a developer account at https://chrome.google.com/webstore/devconsole ($5 one-time fee)
4. Upload the zip, fill in listing details, submit for review

## License

MIT
