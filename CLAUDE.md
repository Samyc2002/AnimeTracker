# Anime Tracker — Monorepo

## Project overview

Anime watchlist tracker available as a Chrome extension and a Next.js web app. Data from AniList GraphQL API.

- **`ext/`** — Chrome Extension (Manifest V3, vanilla JS, no build step)
- **`web/`** — Web App (Next.js, TypeScript, Tailwind, Supabase)

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
- **Color scheme** — deep navy (#0b0e14) + teal accents, matching web app

## Web App (`web/`)

- **Next.js** with App Router, TypeScript, Tailwind CSS v4
- **Supabase** for auth (email/password) and database with RLS policies
- **Deployed on Netlify** with auto-deploy from GitHub main
- **Route groups**: `(auth)` for login/signup, `(dashboard)` for all app pages
- **Public pages** (no auth): landing page, airing schedule, anime detail, search, public playlists, public profiles
- **Auth-required pages**: watchlist, playlists management, settings, stats (wrapped with `RequireAuth`)
- **Auth context**: `AuthContext` in dashboard layout, `useAuth()` hook caches userId/userEmail to avoid repeated `getUser()` calls
- **SFW mode**: `SfwContext` provider, toggle in navbar, filters `isAdult` across all pages
- **Pages**: landing, watchlist (list/card view), search (with recommendations), airing schedule (Mon-Sun weekly grid), anime detail (blurred backdrop), playlists (create/edit/share), settings (AniList OAuth, Kitsu import), stats, notifications, buddies, recommendations, public profiles (/u/username)
- **API routes**: `/api/stats`, `/api/heartbeat`, `/api/auth/anilist/callback`, `/api/playlists/[slug]`, `/api/import-watchlist`, `/api/import-kitsu`, `/api/achievements/*`, `/api/badges/*`, `/api/buddies/*`, `/api/notifications/*`
- **`lib/anime-provider.ts`** — Multi-provider data layer: AniList → Jikan (MAL) → Kitsu with fallback
- **`lib/supabase.ts`** — Supabase client (browser) and `getServiceSupabase()` for server-side routes
- **`lib/provider-status.ts`** — `useProviderHealth()` hook checking AniList, Jikan, Kitsu health; shared between ProviderStatusBanner and settings page
- **`lib/achievements/`** — Achievement engine: `engine.ts` (fireAchievementEvent dispatcher), `evaluators.ts` (27 achievements), `types.ts`, `badge-url.ts`
- **`lib/feature-flags.ts`** — `ACHIEVEMENTS_UI_VISIBLE` (false), `FOUNDING_MEMBER_ENABLED` (true)
- **Color scheme** — deep navy (#0b0e14), cards (#141925), borders (#253040), teal/blue gradient accents
- **Branding** — gradient text (from-teal-400 to-blue-400), logo in all navbars and footer

## Storage (Supabase)

### Tables
- **`watchlist_entries`**: user_id, media_id, id_mal, title_romaji, title_english, cover_url, status, total_episodes, next_airing_episode, next_airing_at, watch_status, is_adult, series_id
- **`watched_episodes`**: user_id, media_id, episode_number — unique constraint on (user_id, media_id, episode_number)
- **`profiles`**: user_id, display_language, anilist_user_id, anilist_token, kitsu_username, username
- **`playlists`**: user_id, title, description, anime_ids (JSON string), visibility, slug
- **`notifications`**: user_id, media_id, type (episode/sequel/buddy_request/buddy_accept/buddy_rec)
- **`buddies`**: sender_id, receiver_id, status, created_at
- **`buddy_recommendations`**: from_user_id, to_user_id, media_id, title, cover_url, message, created_at
- **`achievements`**: achievement definitions
- **`user_achievements`**: user_id, achievement_id, progress, target, unlocked, unlocked_at
- **`badges`**: badge definitions with asset_name
- **`user_badges`**: user_id, badge_id, is_pinned, unlocked_at

### RPCs
- `get_episode_progress(user_id, media_ids[])` — batch episode count query (avoids N+1)
- `get_user_fk_tables()` — used by delete-user admin script

## Code conventions

### Extension
- Vanilla JS, no TypeScript, no framework
- ES module imports throughout
- No external dependencies
- `config.js` gitignored, `config.example.js` committed

### Web App
- TypeScript throughout
- Tailwind v4 for styling (dark theme: `bg-[#0b0e14]`, teal accents)
- Client components use `'use client'` directive
- Supabase browser client is a singleton (`lib/supabase.ts`), service client via `getServiceSupabase()`
- All sensitive config in `.env.local` (gitignored), `.env.local.example` committed

## Environment Variables

### Client-side (NEXT_PUBLIC_)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ANILIST_CLIENT_ID`

### Server-side only
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANILIST_CLIENT_SECRET`
- `TEST_ACCOUNTS` — comma-separated emails excluded from founding member counter
- `CRON_SECRET` — auth for Netlify scheduled functions

## Netlify Functions

- **`sequel-notify`** — scheduled monthly (1st of month), scans completed watchlist for upcoming sequels
- **`import-kitsu-background`** — background function (15-min timeout, named `*-background.mts`) for Kitsu library imports. Uses `ws` package for Node 20 WebSocket compat with Supabase realtime.
- **`daily-achievements`** — scheduled daily achievement checks

## Feature Flags

In `web/lib/feature-flags.ts`:

- **`ACHIEVEMENTS_UI_VISIBLE`** (`false`) — Controls all achievement UI surfaces except Founding Member. When `false`: achievements page hidden, achievement notifications filtered, progress bars hidden. The engine still runs and accumulates progress silently.
- **`FOUNDING_MEMBER_ENABLED`** (`true`) — Controls the Founding Member badge specifically: awareness banner, badge on profile, achievement notification for founding member only.

## Badge Asset Convention

Badge images live in `web/public/badges/[asset_name].png`. The database stores only the `asset_name` (e.g., `founding_member`), never the full path. Use `getBadgeUrl(assetName)` from `web/lib/achievements/badge-url.ts` to resolve the full URL.

## Known issues / decisions

- **AniList OAuth** works on web app but not extension (`chromiumapp.org` redirect not supported). Extension uses JWT bridge instead.
- **Cover images in OS notifications** — must use local icon (CORS). Popup `<img>` tags work fine.
- **AniList queries not shared** between ext and web — extension has no build step, so no shared package. Queries are copied/ported.
- **AniList isAdult flag** is unreliable — some explicit content marked as `isAdult: false`.
- **AniList image field names don't match CDN paths** — medium→/small/, large→/medium/, extraLarge→/large/. Use `upgradeImageUrl()` for legacy entries.
- **Kitsu import** — uses plain `insert` (not upsert) for watchlist_entries since no unique constraint on (user_id, media_id). Episodes use upsert with unique constraint on (user_id, media_id, episode_number).
- **Streaming** — UI built on old feature/streaming branch (now deleted). Not implemented.

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
Requires Supabase project + `.env.local` configured. See `.env.local.example` for all required variables.

106 Vitest tests, ~90% line coverage. Pre-commit hook via Husky runs tests before every commit — never use `--no-verify`.

## Admin Scripts

Scripts are in `scripts/` (gitignored). All require `SUPABASE_SERVICE_KEY` env var.

### Delete a user
```bash
cd scripts
SUPABASE_SERVICE_KEY="your-key" node delete-user.js user@example.com
```
Prints a summary of all records to delete, asks for confirmation, then deletes in FK-safe order.

### Generate badge placeholders
```bash
node scripts/generate-badge-placeholders.js
```
Creates 256x256 placeholder PNGs in `web/public/badges/` for each achievement.
