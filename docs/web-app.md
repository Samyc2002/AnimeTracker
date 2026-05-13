# Web App Guide

The web app lives in `web/` and is built with Next.js (App Router), TypeScript, Tailwind CSS v4, and Supabase.

## Tech Stack

- **Next.js** with App Router
- **TypeScript** throughout
- **Tailwind CSS v4** (dark theme only)
- **Supabase** for auth (email/password) and PostgreSQL database with RLS
- **Netlify** for hosting and serverless functions
- **notistack** for toast notifications (custom dark-themed snackbar components)

## Route Structure

### Route Groups

The app uses Next.js route groups to separate auth and dashboard layouts:

- `(auth)/` -- login, signup, reset password (minimal layout)
- `(dashboard)/` -- all app pages (full layout with nav, footer, context providers)

### Public Pages (no auth required)

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/search` | Anime search with recommendations |
| `/airing` | Weekly airing schedule (Mon-Sun grid) |
| `/anime/[id]` | Anime detail page |
| `/playlists/[slug]` | Public playlist view |
| `/u/[username]` | Public user profile |
| `/privacy` | Privacy policy |

### Auth-Required Pages

| Route | Description |
|-------|-------------|
| `/watchlist` | User's watchlist (list/card view) |
| `/playlists` | Playlist management (create/edit/share) |
| `/notifications` | Episode alerts, buddy requests, achievements |
| `/buddies` | Friend management and search |
| `/recommend` | Smart recommendation quiz |
| `/settings` | AniList OAuth, Kitsu import, preferences |
| `/stats` | Analytics dashboard (admin only) |

All auth-required pages are wrapped with the `RequireAuth` component.

### Admin Pages

| Route | Description |
|-------|-------------|
| `/dev/inventory` | Visual inventory of all UI elements (gated by `ADMIN_EMAILS` env var) |

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/anilist/callback` | GET | AniList OAuth callback |
| `/api/import-watchlist` | POST | AniList watchlist import |
| `/api/import-kitsu` | POST | Kitsu watchlist import |
| `/api/stats` | GET | Admin analytics |
| `/api/heartbeat` | GET | Health check |
| `/api/playlists/[slug]` | GET | Public playlist data |
| `/api/buddies` | GET/POST | Buddy list and requests |
| `/api/buddies/[id]` | PATCH/DELETE | Respond to/remove buddy |
| `/api/notifications/poll` | POST | Check for new notifications |
| `/api/achievements/*` | Various | Achievement queries |
| `/api/badges/*` | Various | Badge queries |
| `/api/taste-profile` | POST | Taste profiling for recommendations |
| `/api/recommend` | POST | Get recommendations |

## Component Architecture

### Layouts

- **Root layout**: metadata, fonts, `globals.css`
- **Dashboard layout**: `AuthContext`, `SfwContext`, `NavBar`, `Footer`, `SnackbarProvider`
- Mobile (< 1280px / xl): bottom nav bar with acrylic texture
- Desktop (>= 1280px): top nav bar

### Core Components (`components/`)

- `AnimeCard` -- card with cover image, title, progress
- `EpisodeGrid` -- click-to-toggle episode tracking grid
- `AddToWatchlist` -- add/remove from watchlist button
- `AddPrequels` -- bulk-add prequel entries
- `RecommendToBuddy` -- recommend anime to a friend
- `FranchiseTabs` -- franchise navigation with watch order
- `SynopsisCollapse` -- collapsible synopsis text
- `NavBar` -- responsive nav with SFW toggle
- `SearchBar` -- search input with keyboard shortcut
- `AddToPlaylist` -- add anime to playlist dropdown

### UI Primitives (`components/ui/`)

- `Spinner` -- loading spinner (sm/md/lg sizes)
- `StatusBadge` -- colored badge with tone variants
- `DashboardInput` -- styled input for dashboard pages
- `AuthInput` -- styled input for auth pages
- `AuthSubmitButton` -- submit button for auth forms

## Lib Modules

### Data Layer

| File | Purpose |
|------|---------|
| `anime-provider.ts` | Facade with `tryProviders()` fallback chain (AniList -> Jikan -> Kitsu) |
| `providers/anilist.ts` | AniList GraphQL client |
| `providers/jikan.ts` | Jikan/MAL REST client |
| `providers/kitsu.ts` | Kitsu REST client |
| `providers/cache.ts` | Search and detail caching |
| `loading-quotes.ts` | 150 anime quotes for loading states (search/recommend/general) |
| `stream-provider.ts` | Streaming URL resolution |

See [providers.md](providers.md) for details on the multi-provider system.

### Auth and Context

| File | Purpose |
|------|---------|
| `supabase.ts` | Browser client (singleton) + `getServiceSupabase()` for server routes |
| `auth-context.tsx` | `AuthContext` provider, `useAuth()` hook |
| `sfw-context.tsx` | SFW/NSFW toggle context |
| `admin.ts` | `getEmailSets()`, `isAdmin()`, `getCallerUserIdFromRequest()` |

### Domain Logic

| File | Purpose |
|------|---------|
| `franchise-traversal.ts` | BFS graph traversal for franchise watch order |
| `taste-profile.ts` | Recommendation engine taste profiling |
| `series-metadata.ts` | Series metadata resolution |
| `series-resolver.ts` | Series ID backfill |
| `achievements/` | Engine, evaluators (27 achievements), types, badge URL helper |
| `feature-flags.ts` | `ACHIEVEMENTS_UI_VISIBLE`, `FOUNDING_MEMBER_ENABLED` |
| `provider-status.ts` | `useProviderHealth()` hook for checking API health |

## Styling

- **Dark theme only**: background `#0b0e14`, cards `#141925`, borders `#253040`
- **Accent**: teal-blue gradient (`from-teal-400 to-blue-400`)
- **Theme system**: `getTheme(sfwMode)` returns theme-aware class names
- **No em-dashes** in user-facing strings (use colons, commas, periods)
- Streaming buttons use frosted glass style with CSS `color-mix()` and `linear-gradient()`

## See Also

- [web/docs/achievements-architecture.md](../web/docs/achievements-architecture.md) -- achievement system deep dive
- [Database Guide](database.md) -- Supabase schema and RLS
- [Providers Guide](providers.md) -- multi-provider data layer
