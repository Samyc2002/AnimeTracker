# Achievements & Badges Architecture

## Overview

- **Achievements**: full catalog of 28 earnable goals (locked/unlocked + progress bars)
- **Badges**: earned achievements a user pins to their public profile (max 5)

## Asset Naming Convention

DB stores **only the asset name** (e.g., `founder_badge`), never a full path.

```typescript
// lib/achievements/badge-url.ts
const BADGE_ASSET_PATH = '/badges';
const BADGE_EXTENSION = '.png';

export function getBadgeUrl(assetName: string): string {
  return `${BADGE_ASSET_PATH}/${assetName}${BADGE_EXTENSION}`;
}
```

Files live in `web/public/badges/[asset_name].png` (256x256px).

## Schema

### `achievements` — Catalog (28 rows)

```sql
create table achievements (
  id text primary key,
  name text not null,
  description text not null,
  asset_name text not null,
  category text not null,        -- 'milestone', 'streak', 'action', 'time', 'composite'
  criteria_type text not null,   -- evaluator key
  criteria_config jsonb not null,
  event_types text[] not null,
  sort_order integer default 0,
  hidden boolean default false,
  tier integer default 1         -- 1=ship now, 2=future features, 3=aspirational
);
```

### `user_achievements` — Per-user progress

```sql
create table user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  achievement_id text references achievements(id) not null,
  progress integer default 0,
  target integer not null,
  unlocked boolean default false,
  unlocked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, achievement_id)
);
```

### `user_badges` — Pinned to public profile (max 5)

```sql
create table user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  achievement_id text references achievements(id) not null,
  pin_order integer not null check (pin_order between 1 and 5),
  created_at timestamptz default now(),
  unique(user_id, achievement_id),
  unique(user_id, pin_order)
);
```

### `user_streaks` — Daily login tracking

```sql
create table user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null unique,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_active_date date,
  updated_at timestamptz default now()
);
```

## Criteria Types (Evaluators)

| criteria_type | Description | Config shape |
|--------------|-------------|--------------|
| `account_created_before` | Account created before date | `{ "date": "2026-05-07T00:00:00Z" }` |
| `action_count` | Count of a specific action | `{ "action": "watchlist_add", "threshold": 1 }` |
| `action_any` | Any of multiple actions occurred | `{ "actions": ["kitsu_import", "anilist_import"] }` |
| `completed_count` | Anime completed count | `{ "threshold": 100 }` |
| `status_count` | Entries with specific watch status | `{ "status": "watching", "threshold": 5 }` |
| `distinct_count` | Distinct values (genres, studios, decades) | `{ "source": "completed_anime_genres", "threshold": 10 }` |
| `account_age_days` | Days since account creation | `{ "days": 365 }` |
| `rewatch_count` | Same anime marked rewatching N times | `{ "threshold": 3 }` |
| `composite_check` | Multiple conditions met | `{ "conditions": ["has_avatar", "has_bio"] }` |
| `relational_check` | Relationship between entries | `{ "check": "completed_sequel_of_completed" }` |

## Event Types & Subscriptions

| Event | Source | Achievements checking |
|-------|--------|----------------------|
| `watchlist_add` | AddToWatchlist | first_steps |
| `status_change` | context menu, status picker | otaku_in_training, seasoned_watcher, centurion, anime_sage, thousand_club, starting_strong, decisive_one, genre_hopper, studio_connoisseur, decade_spanner, continuation, completionist, anime_veteran |
| `playlist_create` | playlists page | curator, tastemaker |
| `buddy_accept` | buddies API | buddy_system, social_butterfly |
| `buddy_recommend` | buddy-recommend API | recommender |
| `import_complete` | settings (AniList/Kitsu import) | importer |
| `login` | heartbeat | founding_user, streak_7, streak_30 |
| `profile_update` | settings save | welcome_aboard |
| `sequel_alert` | sequel notification created | never_miss_out |
| `episode_watched` | anime detail page | (future: notetaker) |

## File Structure

```
web/
  lib/
    achievements/
      types.ts           — interfaces
      badge-url.ts        — getBadgeUrl() helper
      engine.ts           — fireAchievementEvent() dispatcher
      evaluators.ts       — criteria type evaluator functions
  app/
    api/
      achievements/
        route.ts          — GET catalog with user progress
        badges/
          route.ts        — GET/POST pinned badges
        public/
          [username]/
            route.ts      — GET public pinned badges
  netlify/
    functions/
      daily-achievements.mts  — streak resets + time-based checks
  public/
    badges/               — 28 PNG files (256x256)
scripts/
  sql/
    005_achievements_schema.sql
  generate-badge-placeholders.js
```

## Asset Files (28 total)

founder_badge, first_steps, importer, otaku_in_training, seasoned_watcher,
centurion, anime_sage, curator, buddy_system, genre_hopper,
never_miss_out, notetaker, one_year, comfort_watcher, studio_connoisseur,
anime_veteran, tastemaker, welcome_aboard, starting_strong, continuation,
thousand_club, two_year, decade_spanner, decisive_one, completionist,
recommender, social_butterfly
