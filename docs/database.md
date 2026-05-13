# Database Guide

Anime Tracker uses **Supabase** (hosted PostgreSQL) with Row Level Security (RLS) on all user-facing tables.

## Clients

| Client | File | Usage |
|--------|------|-------|
| Browser client | `lib/supabase.ts` | Singleton via `createBrowserClient()`, used in client components |
| Server client | `getServiceSupabase()` | Service role key, bypasses RLS, used in API routes |

## Tables

### User-Facing Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `profiles` | user_id, username, display_language, anilist_user_id, anilist_token, kitsu_username | User settings and linked accounts |
| `watchlist_entries` | user_id, media_id, canonical_anilist_id, import_source, watch_status, title_romaji, title_english, cover_url, status, total_episodes, is_adult, series_id | Core watchlist. `canonical_anilist_id` is the authoritative cross-provider ID |
| `watched_episodes` | user_id, media_id, episode_number | Unique constraint on (user_id, media_id, episode_number) |
| `playlists` | user_id, title, description, anime_ids (JSON string), visibility, slug | Shareable anime playlists |
| `notifications` | user_id, media_id, type, episode, title, cover_url, airing_at, is_read | Types: episode, sequel, buddy_request, buddy_accept, buddy_rec, achievement |
| `buddies` | sender_id, receiver_id, status, created_at | Friend connections |
| `buddy_recommendations` | from_user_id, to_user_id, media_id, title, cover_url, message | Anime recommendations between friends |

### Achievement Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `achievements` | id, name, description, criteria | 27 achievement definitions |
| `user_achievements` | user_id, achievement_id, progress, target, unlocked, unlocked_at | Per-user progress tracking |
| `badges` | id, name, asset_name | Badge definitions. `asset_name` maps to `web/public/badges/[asset_name].png` |
| `user_badges` | user_id, badge_id, is_pinned, unlocked_at | Which badges a user has earned |

### Cache and Metadata Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `anime_cache` | anilist_id, mal_id, data (jsonb) | Detail-page cache. Jikan-sourced rows may have anilist_id=NULL |
| `airing_cache` | cache_key, schedules (jsonb) | Weekly airing schedule cache |
| `series_metadata` | anilist_id, format, season_year, studio, genres | Authoritative metadata store |
| `franchise_watch_orders` | franchise_root_id, ordered_entries (jsonb), computed_at | One row per franchise. computed_at=NULL means computation in progress |
| `franchise_membership` | series_anilist_id, franchise_root_id | Maps individual series to their franchise root |

Cache tables (`franchise_watch_orders`, `franchise_membership`, `anime_cache`, `airing_cache`) are safe to `TRUNCATE CASCADE` if corrupted -- they'll be repopulated automatically.

## Row Level Security

All user-facing tables have RLS enabled. Common patterns:

- **Owner access**: `auth.uid() = user_id` -- users can only read/write their own data
- **Public profiles**: profiles with `is_public = true` are readable by anyone
- **Public playlists**: playlists with `visibility = 'Public'` are readable by anyone
- **Buddies**: both sender and receiver can read; sender creates; receiver responds (PATCH); either can delete

Cache/metadata tables are accessed only via the service role client (bypasses RLS).

## RPCs (Remote Procedure Calls)

| RPC | Parameters | Purpose |
|-----|-----------|---------|
| `get_episode_progress` | user_id, media_ids[] | Batch episode count query, avoids N+1 for watchlist page |
| `get_user_fk_tables` | | Lists all tables with foreign keys to auth.users, used by admin delete-user script |

## Important Rules

1. **`canonical_anilist_id` is the authoritative cross-provider ID**. Never use `media_id` or `id_mal` for cross-provider joins -- `media_id` is not globally unique across providers.

2. **Every `watchlist_entries` INSERT must stamp `import_source` and `canonical_anilist_id`**:
   - AniList import: `import_source='anilist'`, `canonical_anilist_id=media.id`
   - Kitsu import: `import_source='kitsu'`, `canonical_anilist_id=<resolved via MAL->AniList batch>`
   - Manual add: `import_source='manual'`, `canonical_anilist_id=media.id`

3. **`watchlist_entries` uses plain INSERT** (not upsert) since there's no unique constraint on (user_id, media_id). `watched_episodes` uses upsert with its unique constraint.

4. **Jikan-sourced `anime_cache` rows** (where `anilist_id=NULL` or `anilist_id=mal_id`) must not be used by BFS traversal for franchise watch order.

## Migrations

SQL migration files are in `scripts/sql/`, numbered 001 through 014. They must be run in order for new Supabase projects. Since `scripts/` is gitignored, contact a maintainer for the migration files or export them from the Supabase dashboard.

## See Also

- [Providers Guide](providers.md) -- how data gets into the database
- [Web App Guide](web-app.md) -- how the app uses the database
