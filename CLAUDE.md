# Anime Tracker — Monorepo

## Project overview

Anime watchlist tracker available as a Chrome extension and a Next.js web app. Data from AniList GraphQL API.

- **`ext/`** — Chrome Extension (Manifest V3, vanilla JS, no build step)
- **`web/`** — Web App (Next.js, TypeScript, Tailwind, Supabase)

## Extension (`ext/`)

- See `ARCHITECTURE.md` for the full design doc
- **popup/** — UI layer (HTML/CSS/JS), 5 views: notifications (default), watchlist, search, episode detail, settings
- **background/** — service worker for polling AniList airing schedules and dispatching notifications via `chrome.alarms`
- **lib/** — shared modules: `anilist.js` (GraphQL client), `storage.js` (chrome.storage abstraction), `differ.js` (episode diff engine)
- All JS uses ES modules (`import`/`export`)
- **No build step** — plain JS loaded directly by Chrome
- **Manifest V3** — service workers are ephemeral. All state in `chrome.storage`, never in-memory globals. Must declare `"type": "module"` in manifest
- **Notifications** — batched if >3, local icon only (AniList CDN blocks CORS). History persisted in storage
- **Service worker** — does NOT poll on install; first poll when alarm fires. Logs prefixed `[Anime Tracker]`

## Web App (`web/`)

- **Next.js** with App Router, TypeScript, Tailwind CSS
- **Appwrite Cloud** for auth (email/password) and database (document collections)
- **Route groups**: `(auth)` for login/signup, `(dashboard)` for authenticated pages with client-side auth guard
- **Pages**: watchlist, search, airing schedule, settings
- **`lib/anilist.ts`** — TypeScript port of extension's AniList client, plus `fetchWeeklyAiring` query
- **`lib/appwrite.ts`** — Appwrite client, account, databases instances + collection ID constants
- **No middleware** — Appwrite handles sessions via cookies automatically; auth guard in dashboard layout

## Storage

### Extension
Watchlist in `chrome.storage.local` keyed by `mediaId`. Notifications capped at 50. Full schema in `ARCHITECTURE.md`.

### Web App
Appwrite Cloud with document collections: `watchlist_entries`, `watched_episodes`, `profiles`. Each document has a `user_id` field. Profiles auto-created on first settings page visit.

## Code conventions

### Extension
- Vanilla JS, no TypeScript, no framework
- ES module imports throughout
- No external dependencies

### Web App
- TypeScript throughout
- Tailwind for styling (dark theme: `bg-[#0f0f23]`, purple accents)
- Client components use `'use client'` directive
- Appwrite client is a singleton module (`lib/appwrite.ts`)

## Known issues / decisions

- **AniList OAuth** removed from MVP — `chromiumapp.org` redirect URLs not supported. Code exists in `ext/lib/anilist.js` for future use
- **Cover images in OS notifications** — must use local icon (CORS). Popup `<img>` tags work fine
- **AniList queries not shared** between ext and web — extension has no build step, so no shared package. Queries are copied/ported
- **Web app** requires `.env.local` with Appwrite project ID, database ID, and collection IDs

## Testing

### Extension
Load unpacked from `ext/` at `chrome://extensions/`. Test polling:
```js
chrome.storage.local.set({ lastPollTimestamp: 0, airingCache: {}, notifications: [] }, () => {
  chrome.alarms.create('anime-poll', { delayInMinutes: 0.08 });
});
```

### Web App
```bash
cd web && npm run dev
```
Requires Appwrite Cloud project + `.env.local` configured. Create collections in the Appwrite console first (see `.env.local.example` for required IDs).
