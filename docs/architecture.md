# Architecture Overview

Anime Tracker is a monorepo with three main components: a Chrome extension, a Next.js web app, and Netlify serverless functions.

## System Diagram

```
                         +------------------+
                         |   AniList API    |
                         |   (GraphQL)      |
                         +--------+---------+
                                  |
                    +-------------+-------------+
                    |             |              |
              +-----+-----+ +---+----+  +------+------+
              | Jikan API | | Kitsu  |  | AniList     |
              | (MAL REST)| | API    |  | OAuth       |
              +-----------+ +--------+  +-------------+
                    \          |           /
                     \         |          /
                  +---+--------+--------+---+
                  |   anime-provider.ts     |
                  |   (tryProviders         |
                  |    fallback chain)      |
                  +------------+------------+
                               |
              +----------------+----------------+
              |                                 |
    +---------+----------+           +----------+---------+
    |  Next.js Web App   |           | Chrome Extension   |
    |  (web/)            |           | (ext/)             |
    |                    |           |                    |
    |  - App Router      |           | - Manifest V3      |
    |  - Supabase Auth   |   JWT     | - Service Worker   |
    |  - Tailwind v4     +<--bridge--+ - Vanilla JS       |
    |  - SSR + Client    |           | - chrome.storage   |
    +---------+----------+           +--------------------+
              |
    +---------+----------+
    |   Supabase         |
    |   (PostgreSQL+RLS) |
    +---------+----------+
              |
    +---------+----------+
    |  Netlify Functions  |
    |  - sequel-notify    |
    |  - daily-achievemts |
    |  - kitsu-import     |
    +--------------------+
```

## Monorepo Layout

| Directory | Tech | Description |
|-----------|------|-------------|
| `ext/` | Vanilla JS, Manifest V3 | Chrome extension: search, watchlist, notifications |
| `web/` | Next.js, TypeScript, Tailwind, Supabase | Full web app with auth, watchlist, social features |
| `functions/` | Netlify Functions | Scheduled/background tasks |
| `scripts/` | Node.js (gitignored) | Admin scripts (user deletion, badge generation) |
| `docs/` | Markdown | Contributor documentation |

## Data Flow

### User searches for anime
1. User types in search bar
2. `searchAnimePaginated()` in `anime-provider.ts` calls `tryProviders()`
3. AniList is tried first. If it fails, Jikan, then Kitsu
4. Results are normalized to `AniListMedia` interface and returned
5. 15 results per page with Prev/Next pagination

### User adds to watchlist
1. Entry inserted into `watchlist_entries` with `canonical_anilist_id` stamped
2. `backfillSeriesId()` resolves the series for folder grouping
3. Achievement events are fired (`fireClientAchievementEvent`)

### Background flows
- **Pre-commit hook**: Husky runs Vitest with coverage before every commit
- **Netlify scheduled**: `sequel-notify` (monthly 1st), `daily-achievements` (daily)
- **Extension service worker**: Polls AniList airing schedule via `chrome.alarms`, diffs episodes, dispatches OS notifications

## Authentication

| Surface | Method | Details |
|---------|--------|---------|
| Web app | Supabase Auth | Email/password, RLS on all tables |
| Extension | JWT bridge | Content script on animetracker.lol forwards JWT to extension via `chrome.runtime.sendMessage` |
| AniList import | OAuth | Web only; extension can't use it (chromiumapp.org redirect unsupported) |
| Kitsu import | Username | No auth needed, public API by username |

## Key Architectural Decisions

- **Multi-provider fallback**: AniList is primary, Jikan and Kitsu are fallbacks. If one goes down, the app keeps working. See [providers.md](providers.md).
- **AniList IDs as canonical namespace**: `canonical_anilist_id` is the authoritative cross-provider ID. Never use `media_id` or `id_mal` for cross-provider joins.
- **No build step for extension**: Vanilla JS with ES modules. No shared packages with `web/` -- AniList queries are duplicated, not shared.
- **Feature flags for incremental rollout**: Achievements engine runs silently while UI is behind `ACHIEVEMENTS_UI_VISIBLE` flag.
- **Franchise traversal**: BFS graph traversal for watch order computation, cached in `franchise_watch_orders` table. Long operations use SSE streaming.

## Deployment

| Component | Platform | Trigger |
|-----------|----------|---------|
| Web app | Netlify | Auto-deploy on push to `main` |
| Extension | Chrome Web Store | Manual publish |
| Domain | animetracker.lol | Netlify DNS |
| Database | Supabase | Hosted PostgreSQL |

## Further Reading

- [Web App Guide](web-app.md) -- routes, components, lib modules
- [Extension Guide](extension.md) -- manifest, service worker, storage
- [Database Guide](database.md) -- Supabase schema, RLS, RPCs
- [Providers Guide](providers.md) -- multi-provider fallback, caching
- [ARCHITECTURE.md](../ARCHITECTURE.md) (repo root) -- detailed extension design document
