# Anime Tracker — Chrome Extension Architecture

## Overview

A Chrome extension that lets you maintain an anime watchlist, track watched episodes, and receive notifications when new episodes drop. Data is sourced from the AniList GraphQL API and stored locally in Chrome storage.

---

## High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  AniList GraphQL API          Chrome Notifications API      │
│  (schedules, search,          (new episode alerts)          │
│   list import)                                              │
│                                                             │
└──────┬──────────┬─────────────────────────────┬─────────────┘
       │          │                             │
       ▼          ▼                             ▲
┌──────────────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                              │
│                                                              │
│  ┌──────────────────┐    chrome.runtime    ┌───────────────┐ │
│  │   Popup UI       │◄──── messages ──────►│ Service Worker │ │
│  │                  │                      │               │ │
│  │  - Notifications │                      │ - Poll loop   │ │
│  │  - Search anime  │                      │ - Episode diff│ │
│  │  - Watchlist     │                      │ - Notify      │ │
│  └────────┬─────────┘                      └───────┬───────┘ │
│           │                                        │         │
│           ▼                                        ▼         │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Chrome Storage (local)                               │   │
│  │                                                       │   │
│  │  Watchlist entries, episode watch state,               │   │
│  │  airing schedule cache, notification history,         │   │
│  │  user settings                                        │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Extension file structure

```
anime-tracker/
├── manifest.json
├── popup/
│   ├── index.html
│   ├── popup.js            # UI logic (vanilla JS)
│   └── popup.css
├── background/
│   └── service-worker.js   # Polling + notification dispatch
├── lib/
│   ├── anilist.js          # GraphQL client wrapper
│   ├── storage.js          # chrome.storage.local abstraction
│   └── differ.js           # Episode diff engine
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

---

## Component breakdown

### 1. Popup UI

The main interface users interact with when they click the extension icon.

**Responsibilities:**
- Display notification feed with unwatched episode highlighting
- Search for anime via AniList and add to watchlist
- Display the current watchlist with cover art, title, and airing status
- Render an episode grid per series (1, 2, 3, ..., N)
- Toggle episode watched state on click

**Views (tab order):**
- **Notifications view** (default) — feed of new episode alerts; unwatched episodes are highlighted with a purple left border; clicking an unwatched notification marks it as watched. Shows "Episode X of Anime Name" format
- **Watchlist view** — cards for each tracked anime showing title, cover, next episode date, and progress (e.g., "7/12 watched")
- **Search view** — text input that queries AniList `Media` search, shows results with an "Add" button
- **Episode detail view** — numbered grid for a specific anime; clicked episodes are marked as watched
- **Settings view** — poll interval, notification toggle, title language

### 2. Service Worker (background)

Runs in the background via `chrome.alarms`. No persistent connection — wakes up on schedule, does work, goes back to sleep.

**Responsibilities:**
- Register a `chrome.alarms` alarm on install (default: every 30 minutes)
- On alarm fire: pull watchlist `mediaId` list from storage
- Query AniList `AiringSchedule` for episodes airing between `lastPollTimestamp` and `now`
- Diff results against cached state to find genuinely new episodes
- Persist new episodes to notification history in storage
- Fire `chrome.notifications.create()` for each new episode (uses local icon — AniList CDN blocks CORS)
- Update `lastPollTimestamp` and airing cache in storage

**Why 30 minutes?** AniList rate limit is 90 requests/minute. A single poll for 20 tracked shows costs 1 request (batch query). 30 minutes is conservative, responsive enough for episode drops (most anime releases have a known schedule), and keeps the extension lightweight. This interval is user-configurable.

### 3. Chrome Storage (local)

All data lives in `chrome.storage.local`. No backend, no cloud sync, no accounts.

**Why local?** Simpler architecture, zero infrastructure cost, no auth flow for storage, and the data is small (a watchlist of 50 anime is ~50KB). Cloud sync can be added later if needed.

### 4. AniList GraphQL API

The single external data source. Free, no API key required for public queries. OAuth2 required only for importing a user's personal list.

**Key queries:**

#### Search for anime
```graphql
query SearchAnime($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME) {
      id
      idMal
      title { romaji english }
      coverImage { medium }
      status
      episodes
      nextAiringEpisode {
        airingAt
        episode
      }
    }
  }
}
```

#### Poll airing schedule (batch — used by service worker)
```graphql
query AiringSchedule($mediaIds: [Int], $from: Int, $to: Int) {
  Page(perPage: 50) {
    airingSchedules(
      mediaId_in: $mediaIds,
      airingAt_greater: $from,
      airingAt_lesser: $to
    ) {
      mediaId
      episode
      airingAt
    }
  }
}
```

#### Import user's AniList list (requires OAuth token)
```graphql
query UserList($userId: Int) {
  MediaListCollection(userId: $userId, type: ANIME, status_in: [CURRENT, PLANNING]) {
    lists {
      entries {
        media {
          id
          idMal
          title { romaji english }
          coverImage { medium }
          status
          episodes
          nextAiringEpisode { airingAt episode }
        }
        progress
      }
    }
  }
}
```

### 5. Chrome Notifications API

Fires native OS notifications when new episodes are detected.

**Notification payload:**
```js
chrome.notifications.create(`ep-${mediaId}-${episode}`, {
  type: 'basic',
  iconUrl: '../icons/icon-128.png',  // Local icon — AniList CDN blocks CORS
  title: `New Episode Dropped!`,
  message: `${animeTitle} — Episode ${episode} is now available`,
  priority: 2
});
```

---

## Data model

### Watchlist entry

```js
{
  mediaId: 123456,               // AniList media ID
  idMal: 54321,                  // MAL ID (for cross-referencing)
  title: {
    romaji: "Sousou no Frieren",
    english: "Frieren: Beyond Journey's End"
  },
  coverUrl: "https://...",
  status: "RELEASING",           // RELEASING | FINISHED | NOT_YET_RELEASED
  totalEpisodes: 28,             // null if unknown
  nextAiringEpisode: {
    airingAt: 1700000000,        // Unix timestamp
    episode: 15
  },
  episodesWatched: [1, 2, 3, 4, 5, 6, 7],  // Array of watched episode numbers
  addedAt: 1699000000
}
```

### Full storage schema

```js
{
  // Watchlist — keyed by mediaId for O(1) lookups
  watchlist: {
    [mediaId: number]: WatchlistEntry
  },

  // Last successful poll timestamp (Unix seconds)
  lastPollTimestamp: number,

  // Cached airing data from last poll
  airingCache: {
    [mediaId: number]: {
      latestEpisode: number,
      airingAt: number
    }
  },

  // Notification history (newest first, capped at 50)
  notifications: [
    {
      mediaId: number,
      episode: number,
      airingAt: number,           // Unix timestamp of airing
      title: string,              // Resolved display title
      coverUrl: string,           // Cover image URL
      timestamp: number           // When notification was created (Unix seconds)
    }
  ],

  // User settings
  settings: {
    pollIntervalMinutes: 30,       // 15 | 30 | 60
    notificationsEnabled: true,
    displayLanguage: "english"     // "english" | "romaji"
  }
}
```

---

## Key flows

### Adding anime to watchlist

```
User types in search bar
  → popup.js calls anilist.search(query)
  → AniList returns matching media
  → User clicks "Add"
  → storage.addToWatchlist(mediaEntry)
  → Writes to chrome.storage.local
  → Popup re-renders watchlist view
```

### Polling for new episodes

```
chrome.alarms fires (every 30 min)
  → service-worker.js wakes up
  → Reads watchlist mediaIds from storage
  → Reads lastPollTimestamp from storage
  → Queries AniList AiringSchedule(mediaIds, from=lastPoll, to=now)
  → differ.js compares results vs airingCache
  → For each new episode:
      → Persist to notification history in storage
      → chrome.notifications.create(...)
      → Update airingCache in storage
  → Update lastPollTimestamp = now
  → Service worker goes idle
```

### Marking an episode as watched

```
User opens anime detail in popup
  → Episode grid renders (1, 2, 3, ..., N)
  → User clicks episode number
  → Toggle episode in episodesWatched array
  → Write updated entry to chrome.storage.local
  → Re-render grid (watched episodes visually distinct)
```

### Marking episode as watched from notification

```
User opens popup (Notifications tab is default)
  → Notification feed renders with watched/unwatched state
  → Unwatched notifications highlighted (purple border)
  → User clicks unwatched notification
  → toggleEpisodeWatched(mediaId, episode) called
  → Notification feed re-renders (card loses highlight)
```

---

## Manifest V3 config

```json
{
  "manifest_version": 3,
  "name": "Anime Tracker",
  "version": "1.0.0",
  "description": "Track your anime watchlist and get notified when new episodes drop.",
  "permissions": [
    "storage",
    "alarms",
    "notifications"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

---

## Rate limits and constraints

| Concern | Detail |
|---|---|
| AniList rate limit | 90 requests/minute — a 30-min poll interval with batch queries stays well under this |
| `chrome.storage.local` size | 10 MB default (can request `unlimitedStorage` permission if needed) |
| Service worker lifecycle | MV3 service workers are ephemeral — they spin up on events and die after ~30s of inactivity. All state must be in `chrome.storage`, never in-memory globals |
| Notification limits | Chrome throttles notifications if you spam them. Batch multiple episode drops into a single notification if >3 fire at once |

---

## MVP (shipped)

1. **AniList search + add to watchlist** — search → add → persist → render
2. **Episode grid with click-to-mark-watched** — the tracking piece
3. **Service worker polling + notifications** — detection, OS alerts, and in-app notification feed
4. **Notification feed as default tab** — unwatched episodes highlighted, click to mark watched

---

## Future considerations

- **AniList list import (OAuth)** — code exists in `anilist.js` (`fetchViewer`, `fetchUserList`) but AniList OAuth doesn't support `chromiumapp.org` redirect URLs. Needs a proxy or different auth approach
- **Redirect to streaming sites** — when a notification fires or user clicks an episode, open a configurable streaming URL
- **Cloud sync** — Supabase or Firebase backend so the watchlist persists across devices
- **Auto-detect watched episodes** — content script that detects when you're on a streaming site and auto-marks episodes
- **MAL direct import** — Jikan API integration as an alternative to AniList OAuth
- **Badge count** — show unwatched episode count on the extension icon via `chrome.action.setBadgeText`
