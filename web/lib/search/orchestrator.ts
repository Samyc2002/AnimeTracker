import type { SearchFilterState, OrchestratorResult, ProviderAdapter } from '@/lib/search/types';
import { anilistAdapter } from '@/lib/search/adapters/anilist';
import { jikanAdapter } from '@/lib/search/adapters/jikan';
import { kitsuAdapter } from '@/lib/search/adapters/kitsu';
import { cacheAdapter } from '@/lib/search/adapters/cache';
import { supabase } from '@/lib/supabase';

const ADAPTER_CHAIN: ProviderAdapter[] = [
  anilistAdapter,
  jikanAdapter,
  kitsuAdapter,
  cacheAdapter,
];

const CACHE_TTL = 60_000;
const watchlistCache = new Map<string, { ids: number[]; fetchedAt: number }>();

async function getExcludedIds(userId: string, statuses: string[]): Promise<number[]> {
  const key = `${userId}:${[...statuses].sort().join(',')}`;
  const cached = watchlistCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.ids;

  const { data } = await supabase
    .from('watchlist_entries')
    .select('media_id')
    .eq('user_id', userId)
    .in('watch_status', statuses);

  const ids = (data ?? []).map((r) => r.media_id as number).filter(Boolean);
  watchlistCache.set(key, { ids, fetchedAt: Date.now() });
  return ids;
}

export async function searchWithFilters(
  filters: SearchFilterState,
  userId?: string | null,
): Promise<OrchestratorResult> {
  const hasWatchlistFilter = filters.excludeWatchlistStatuses.length > 0 && !!userId;
  const excludedIds = hasWatchlistFilter
    ? await getExcludedIds(userId!, filters.excludeWatchlistStatuses)
    : [];

  let lastError: Error | null = null;

  for (const adapter of ADAPTER_CHAIN) {
    try {
      const isAniList = adapter.name === 'anilist';

      const result = isAniList && excludedIds.length > 0
        ? await adapter.search(filters, { excludedIds })
        : await adapter.search(filters);

      if (!isAniList && excludedIds.length > 0) {
        const excludeSet = new Set(excludedIds);
        const filtered = result.results.filter((m) => !excludeSet.has(m.id));
        return {
          results: filtered,
          totalCount: result.totalCount,
          hasNextPage: result.hasNextPage,
          activeProvider: adapter.name,
          isPostFiltered: true,
        };
      }

      return { ...result, activeProvider: adapter.name, isPostFiltered: false };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('All providers failed');
}

export function getAdapterCapabilities() {
  return ADAPTER_CHAIN.map((a) => ({ name: a.name, capabilities: a.capabilities }));
}
