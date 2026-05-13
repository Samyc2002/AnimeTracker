# Multi-Provider Data Layer

Anime Tracker uses three anime data providers with automatic fallback. If one goes down, the app keeps working.

## Providers

| Provider | Role | API | Rate Limit | Auth |
|----------|------|-----|------------|------|
| **AniList** | Primary | GraphQL (`graphql.anilist.co`) | 90 req/min | None (public queries) |
| **Jikan** | Fallback 1 | REST (wraps MyAnimeList) | ~3 req/sec | None |
| **Kitsu** | Fallback 2 | REST (JSON:API format) | Liberal | None |

## How Fallback Works

The core function is `tryProviders()` in `lib/anime-provider.ts`:

```
tryProviders("search", anilistFn, jikanFn, kitsuFn)
```

1. Tries AniList first
2. If AniList throws, catches the error and tries Jikan
3. If Jikan throws, tries Kitsu
4. If all three fail, throws the last error
5. For search page 1, a final cache fallback kicks in before throwing

Each provider has an in-memory cache with a TTL (5 min for AniList, 10 min for Jikan), so rapid successive calls don't re-hit the API.

## Provider Files

| File | Exports |
|------|---------|
| `lib/providers/anilist.ts` | `searchAnilist()`, `searchAnilistPaginated()`, `fetchAnilistDetail()`, `searchAnilistFiltered()` |
| `lib/providers/jikan.ts` | `searchJikan()`, `searchJikanPaginated()`, `fetchJikanDetail()`, `fetchJikanSchedule()` |
| `lib/providers/kitsu.ts` | `searchKitsu()`, `searchKitsuPaginated()`, `fetchKitsuDetail()`, `fetchKitsuLibrary()` |
| `lib/providers/cache.ts` | `getCachedSearch()`, `saveSearchToCache()`, `getCachedAnime()`, `saveAnimeToCache()` |
| `lib/anime-provider.ts` | `searchAnime()`, `searchAnimePaginated()`, `fetchAnimeDetail()`, `tryProviders()` |

## Paginated Search

Search returns 15 results per page (`SEARCH_PER_PAGE` constant).

Each provider implements pagination differently:

| Provider | Pagination Mechanism | hasNextPage Source |
|----------|---------------------|--------------------|
| AniList | `Page(page, perPage)` GraphQL variables | `pageInfo { hasNextPage }` |
| Jikan | `?page=N&limit=N` query params | `pagination.has_next_page` |
| Kitsu | `?page[offset]=N&page[limit]=N` query params | `links.next` exists |

Usage:

```typescript
const { results, hasNextPage } = await searchAnimePaginated("naruto", 1);
```

The UI shows Prev/Next buttons. "Page X" is displayed without "of Y" since the APIs only return `hasNextPage`, not a total count.

## Data Normalization

All providers normalize their responses to the `AniListMedia` interface (defined in `lib/types.ts`):

- `id` -- AniList ID (canonical)
- `idMal` -- MyAnimeList ID (foreign key)
- `title` -- `{ romaji, english }`
- `coverImage` -- `{ medium, large, extraLarge }`
- `status` -- RELEASING, FINISHED, NOT_YET_RELEASED, CANCELLED
- `episodes` -- total episode count
- `isAdult` -- NSFW flag (unreliable for some entries)
- `nextAiringEpisode` -- `{ episode, airingAt }`

Jikan and Kitsu responses are transformed to match this shape in their respective provider files.

## Provider Health

`useProviderHealth()` hook in `lib/provider-status.ts` checks the health of all three providers:

- Pings each provider's endpoint
- Used by `ProviderStatusBanner` to show degradation warnings
- Used by settings page to disable import buttons when a provider is down

## Caching

### Search Cache (`providers/cache.ts`)

- `getCachedSearch(query)` / `saveSearchToCache(query, results)`
- Used as a last-resort fallback when all providers fail on page 1

### Detail Cache (`anime_cache` Supabase table)

- `getCachedAnime(id)` by AniList ID or MAL ID
- `saveAnimeToCache(detail)` after successful fetch
- Has `stale` and `complete` flags for cache invalidation

### Airing Cache

- Weekly airing schedule cached by week start timestamp
- `getCachedAiring(from)` / `saveAiringToCache(from, schedules)`
- Returns cached data while fresh fetch runs in the background

## Adding a New Provider

1. Create `lib/providers/[name].ts` with search, detail, and paginated search functions
2. Map responses to the `AniListMedia` interface
3. Add to the `tryProviders()` calls in `anime-provider.ts`
4. Add a health check endpoint in `provider-status.ts`
5. Write tests in `lib/__tests__/anime-provider.test.ts`

## See Also

- [Database Guide](database.md) -- where provider data gets stored
- [Architecture Overview](architecture.md) -- system-level view
