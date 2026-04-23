# Anime Tracker — Monorepo

## Project overview

Anime watchlist tracker available as a Chrome extension and a Next.js web app. Data from AniList GraphQL API.

- **`ext/`** — Chrome Extension (Manifest V3, vanilla JS, no build step)
- **`web/`** — Web App (Next.js, TypeScript, Tailwind, Appwrite Cloud)

## Extension (`ext/`)

- See `ARCHITECTURE.md` for the full design doc
- **popup/** — UI layer (HTML/CSS/JS), 5 views: notifications (default), watchlist, search, episode detail, settings
- **background/** — service worker for polling AniList airing schedules and dispatching notifications via `chrome.alarms`
- **lib/** — shared modules: `anilist.js` (GraphQL client), `storage.js` (dual-backend: chrome.storage + Appwrite), `differ.js` (episode diff engine), `auth.js` (JWT management), `appwrite-client.js` (raw REST wrapper), `appwrite-storage.js` (Appwrite-backed ops), `config.js` (gitignored constants), `transforms.js` (data shape conversion)
- **content/** — `bridge.js` content script injected on web app pages to forward JWT to extension
- All JS uses ES modules (`import`/`export`)
- **No build step** — plain JS loaded directly by Chrome
- **Manifest V3** — service workers are ephemeral. All state in `chrome.storage`, never in-memory globals. Must declare `"type": "module"` in manifest
- **Notifications** — batched if >3, local icon only (AniList CDN blocks CORS). History persisted in storage
- **Service worker** — does NOT poll on install; first poll when alarm fires. Logs prefixed `[Anime Tracker]`
- **Appwrite sync** — optional. When logged into web app, JWT is forwarded via content script. `storage.js` routes reads/writes to Appwrite when authenticated, chrome.storage when not. Uses `credentials: 'omit'` to avoid JWT+cookie conflict.
- **Color scheme** — deep navy (#0b0e14) + teal accents, matching web app

## Web App (`web/`)

- **Next.js** with App Router, TypeScript, Tailwind CSS
- **Appwrite Cloud** (Singapore region) for auth (email/password) and database
- **Route groups**: `(auth)` for login/signup, `(dashboard)` for all app pages
- **Public pages** (no auth): landing page, airing schedule, anime detail, search, public playlists
- **Auth-required pages**: watchlist, playlists management, settings, stats (wrapped with `RequireAuth`)
- **Auth context**: `AuthContext` in dashboard layout, `useAuth()` hook for components
- **SFW mode**: `SfwContext` provider, toggle in navbar, filters `isAdult` across all pages
- **Pages**: landing, watchlist (list/card view), search (with recommendations), airing schedule (Mon-Sun weekly grid), anime detail (blurred backdrop), playlists (create/edit/share), settings (language, AniList OAuth), stats (analytics dashboard)
- **API routes**: `/api/stats` (analytics), `/api/heartbeat` (online tracking), `/api/auth/anilist/callback` (OAuth), `/api/playlists/[slug]` (public playlist data)
- **`lib/anilist.ts`** — AniList GraphQL client with auth token support. Queries: search, airing, weekly airing, detail, trending/popular, viewer, user list
- **`lib/appwrite.ts`** — Appwrite client singleton + collection ID constants
- **`lib/stream-provider.ts`** — Placeholder streaming interface (feature/streaming branch)
- **`lib/online-tracker.ts`** — In-memory heartbeat tracker for online user count
- **`lib/sfw-context.tsx`** — SFW mode React context with localStorage persistence
- **Color scheme** — deep navy (#0b0e14), cards (#141925), borders (#253040), teal/blue gradient accents
- **Branding** — gradient text (from-teal-400 to-blue-400), logo in all navbars and footer

## Storage

### Extension
Watchlist in `chrome.storage.local` keyed by `mediaId`. Notifications capped at 50. Auth state (JWT) in chrome.storage.local. Config in gitignored `config.js`.

### Web App
Appwrite Cloud with document collections:
- **`watchlist_entries`**: user_id, media_id, id_mal, title_romaji, title_english, cover_url, status, total_episodes, next_airing_episode, next_airing_at, watch_status, is_adult
- **`watched_episodes`**: user_id, media_id, episode_number
- **`profiles`**: user_id, display_language, anilist_user_id, anilist_token
- **`playlists`**: user_id, title, description, anime_ids (JSON string), visibility, slug

## Code conventions

### Extension
- Vanilla JS, no TypeScript, no framework
- ES module imports throughout
- No external dependencies
- `config.js` gitignored, `config.example.js` committed

### Web App
- TypeScript throughout
- Tailwind for styling (dark theme: `bg-[#0b0e14]`, teal accents)
- Client components use `'use client'` directive
- Appwrite client is a singleton module (`lib/appwrite.ts`)
- All sensitive config in `.env.local` (gitignored), `.env.local.example` committed
- `node-appwrite` for server-side API routes, `appwrite` for client-side

## Environment Variables

### Client-side (NEXT_PUBLIC_)
- `NEXT_PUBLIC_APPWRITE_ENDPOINT` — Appwrite API endpoint
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID` — Appwrite project ID
- `NEXT_PUBLIC_APPWRITE_DATABASE_ID` — Database ID
- `NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID`
- `NEXT_PUBLIC_APPWRITE_WATCHED_EPISODES_COLLECTION_ID`
- `NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID`
- `NEXT_PUBLIC_APPWRITE_PLAYLISTS_COLLECTION_ID`
- `NEXT_PUBLIC_ANILIST_CLIENT_ID` — AniList OAuth client ID

### Server-side only
- `APPWRITE_API_KEY` — Server SDK key (scopes: users.read, documents.read, documents.write)
- `ANILIST_CLIENT_SECRET` — AniList OAuth secret

## Known issues / decisions

- **AniList OAuth** works on web app but not extension (`chromiumapp.org` redirect not supported). Extension uses JWT bridge instead.
- **Cover images in OS notifications** — must use local icon (CORS). Popup `<img>` tags work fine.
- **AniList queries not shared** between ext and web — extension has no build step, so no shared package. Queries are copied/ported.
- **AniList isAdult flag** is unreliable — some explicit content (e.g., "Do You Like Big Girls?") marked as `isAdult: false`.
- **AniList image field names don't match CDN paths** — medium→/small/, large→/medium/, extraLarge→/large/. Use `upgradeImageUrl()` for legacy entries.
- **Streaming** on feature/streaming branch — UI built, scraping not implemented. See `web/STREAMING.md`.

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
Requires Appwrite Cloud project + `.env.local` configured. See `.env.local.example` for all required variables.
