import type { AniListMedia } from '@/lib/types';

const KITSU_BASE = 'https://kitsu.io/api/edge';
const ANILIST_API = 'https://graphql.anilist.co';

const ANILIST_MAL_BATCH_QUERY = `
query ResolveByMalIds($malIds: [Int]) {
  Page(perPage: 50) {
    media(idMal_in: $malIds, type: ANIME) {
      id
      idMal
      genres
      tags { name rank }
      studios(isMain: true) { nodes { name isMain } }
      format
      season
      seasonYear
      source
      episodes
      duration
      averageScore
      popularity
    }
  }
}`;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchKitsuMalId(kitsuId: number): Promise<number | null> {
  try {
    const res = await fetch(
      `${KITSU_BASE}/anime/${kitsuId}/mappings?filter[externalSite]=myanimelist%2Fanime&page[limit]=1`,
      { headers: { Accept: 'application/vnd.api+json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entry = data?.data?.[0];
    if (!entry) return null;
    const malId = parseInt(entry.attributes?.externalId, 10);
    return isNaN(malId) ? null : malId;
  } catch {
    return null;
  }
}

async function resolveMalIdsToAniList(malIds: number[]): Promise<Map<number, AniListMedia>> {
  const result = new Map<number, AniListMedia>();
  for (let i = 0; i < malIds.length; i += 50) {
    const batch = malIds.slice(i, i + 50);
    try {
      const res = await fetch(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ANILIST_MAL_BATCH_QUERY, variables: { malIds: batch } }),
      });
      if (res.ok) {
        const data = await res.json();
        for (const media of data?.data?.Page?.media ?? []) {
          if (media.id && media.idMal) result.set(media.idMal, media as AniListMedia);
        }
      }
    } catch {
      // batch failed — caller handles missing entries as unresolved
    }
    if (i + 50 < malIds.length) await sleep(1100);
  }
  return result;
}

export interface KitsuResolveResult {
  kitsuId: number;
  malId: number | null;
  anilistId: number | null;
  media: AniListMedia | null; // full metadata when resolved, null otherwise
}

/**
 * Given a list of Kitsu anime IDs, resolves each to its canonical AniList ID
 * and returns full AniList metadata as a side effect of the batch query.
 *
 * Process:
 *   1. Fetch Kitsu→MAL mapping for each ID (sequential, 500ms apart)
 *   2. Batch-resolve MAL→AniList in groups of 50 (1100ms between batches)
 *      — the batch query also fetches metadata fields, zero extra API calls
 *
 * Entries where no mapping is found get anilistId: null, media: null.
 */
export async function resolveKitsuToAniList(kitsuIds: number[]): Promise<KitsuResolveResult[]> {
  const results: KitsuResolveResult[] = [];
  const malPending: { kitsuId: number; malId: number }[] = [];

  // Phase 1: Kitsu → MAL (sequential, rate-limited)
  for (let i = 0; i < kitsuIds.length; i++) {
    const kitsuId = kitsuIds[i];
    const malId = await fetchKitsuMalId(kitsuId);
    if (malId !== null) {
      malPending.push({ kitsuId, malId });
    } else {
      results.push({ kitsuId, malId: null, anilistId: null, media: null });
    }
    if (i < kitsuIds.length - 1) await sleep(500);
  }

  // Phase 2: MAL → AniList with full metadata (batched, 50 per request)
  if (malPending.length > 0) {
    const malIds = malPending.map((p) => p.malId);
    const anilistMap = await resolveMalIdsToAniList(malIds);
    for (const { kitsuId, malId } of malPending) {
      const media = anilistMap.get(malId) ?? null;
      results.push({ kitsuId, malId, anilistId: media?.id ?? null, media });
    }
  }

  return results;
}
