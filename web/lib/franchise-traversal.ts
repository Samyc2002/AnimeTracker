import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAnilistDetail } from '@/lib/providers/anilist';
import { getCachedAnime, saveAnimeToCache } from '@/lib/providers/cache';
import { upsertSeriesMetadataBatch } from '@/lib/series-metadata';
import type { AnimeDetail } from '@/lib/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_NODES = 50;
const RATE_LIMIT_MS = 1100;
const MAX_RETRIES = 3;
const BACKOFF_MS = 30_000;

const INCLUDE_RELATION_TYPES = new Set([
  'PREQUEL', 'SEQUEL', 'SIDE_STORY', 'PARENT', 'ALTERNATIVE', 'SUMMARY', 'SPIN_OFF',
]);

// Lower number = stronger relationship. Used to prefer the most meaningful
// relation type when a node is reachable via multiple paths.
const RELATION_STRENGTH: Record<string, number> = {
  ROOT:        -1,
  PREQUEL:      0,
  SEQUEL:       0,
  SIDE_STORY:   1,
  PARENT:       1,
  ALTERNATIVE:  2,
  SUMMARY:      3,
  SPIN_OFF:     4,
};

const FORMAT_PRIORITY: Record<string, number> = {
  TV:      0,
  MOVIE:   1,
  OVA:     2,
  ONA:     3,
  SPECIAL: 4,
  MUSIC:   5,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FranchiseEntry {
  anilist_id: number;
  relation_type: string;
}

export interface TraversalResult {
  orderedEntries: FranchiseEntry[];
  truncated: boolean;
  rootId: number;
}

// ─── Rate-limited fetch with retry ───────────────────────────────────────────

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchWithRetry(id: number, franchiseRoot: number): Promise<AnimeDetail | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchAnilistDetail(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // TODO: replace with typed AnilistRateLimitError once fetchAnilistDetail surfaces typed errors
      const is429 = msg.includes('429') || msg.includes('Rate limit') || msg.includes('Too Many');

      if (is429 && attempt < MAX_RETRIES) {
        // Prefer Retry-After header if fetchAnilistDetail surfaces it; currently unavailable
        console.warn(
          `[franchise-traversal] 429 on node ${id} (franchise root ${franchiseRoot}), ` +
          `attempt ${attempt + 1}/${MAX_RETRIES}, backing off ${BACKOFF_MS / 1000}s`
        );
        await sleep(BACKOFF_MS);
        continue;
      }

      // Node is dropped from this traversal entirely — NOT requeued.
      // truncated=true signals the result is incomplete.
      // Next cron-triggered recompute will retry this node from scratch.
      console.error(
        `[franchise-traversal] FAILED to fetch node ${id} (franchise root ${franchiseRoot}) ` +
        `after ${attempt + 1} attempt(s): ${msg}. Node dropped. Marking traversal truncated.`
      );
      return null;
    }
  }
  return null;
}

// ─── BFS graph discovery ──────────────────────────────────────────────────────

async function discoverFranchiseGraph(startId: number): Promise<{
  visited: Map<number, AnimeDetail>;
  relationType: Map<number, string>;
  truncated: boolean;
}> {
  const visited = new Map<number, AnimeDetail>();
  const relationType = new Map<number, string>([[startId, 'ROOT']]);
  const queue: number[] = [startId];
  let truncated = false;

  while (queue.length > 0 && visited.size < MAX_NODES) {
    const batch = queue.splice(0, 5);

    for (const nid of batch) {
      if (visited.has(nid)) continue;

      // Check anime_cache first — only trust rows with anilist_id set (not Jikan-sourced)
      // and relations_json present (complete flag). Saves an AniList API call.
      const cached = await getCachedAnime({ anilistId: nid });
      let detail: AnimeDetail | null = null;

      if (cached && !cached.stale && cached.complete) {
        detail = cached.detail;
      } else {
        detail = await fetchWithRetry(nid, startId);
        if (detail === null) {
          truncated = true;
          continue;
        }
        await saveAnimeToCache(detail);
        await sleep(RATE_LIMIT_MS);
      }

      visited.set(nid, detail);

      for (const edge of detail.relations.edges) {
        if (edge.node.type !== 'ANIME') continue;
        const rt = edge.relationType;
        if (!INCLUDE_RELATION_TYPES.has(rt)) continue;
        const nbr = edge.node.id;

        // Keep the strongest (lowest number) relation type for this node
        const curStrength = RELATION_STRENGTH[relationType.get(nbr) ?? 'OTHER'] ?? 99;
        const newStrength = RELATION_STRENGTH[rt] ?? 99;
        if (!relationType.has(nbr) || newStrength < curStrength) {
          relationType.set(nbr, rt);
        }

        if (!visited.has(nbr) && !queue.includes(nbr)) {
          queue.push(nbr);
        }
      }
    }
  }

  if (queue.length > 0) {
    truncated = true;
    console.warn(
      `[franchise-traversal] hit MAX_NODES (${MAX_NODES}) for franchise root ${startId}. ` +
      `${queue.length} nodes undiscovered: [${queue.join(', ')}]`
    );
  }

  return { visited, relationType, truncated };
}

// ─── Topological sort (Kahn's algorithm) ─────────────────────────────────────

function sortFranchise(
  visited: Map<number, AnimeDetail>,
  relationType: Map<number, string>,
): number[] {
  // Build directed graph: A → B means B is a SEQUEL of A
  const adj = new Map<number, Set<number>>();
  const inDeg = new Map<number, number>();

  for (const nid of visited.keys()) {
    adj.set(nid, new Set());
    inDeg.set(nid, 0);
  }

  for (const [nid, detail] of visited) {
    for (const edge of detail.relations.edges) {
      if (edge.node.type !== 'ANIME') continue;
      if (edge.relationType !== 'SEQUEL') continue;
      const nbr = edge.node.id;
      if (!visited.has(nbr)) continue;
      if (!adj.get(nid)!.has(nbr)) {
        adj.get(nid)!.add(nbr);
        inDeg.set(nbr, (inDeg.get(nbr) ?? 0) + 1);
      }
    }
  }

  function sortKey(nid: number): [number, number] {
    const d = visited.get(nid)!;
    return [
      d.seasonYear ?? 9999,
      FORMAT_PRIORITY[d.format ?? ''] ?? 6,
    ];
  }

  const result: number[] = [];
  const zeroes = [...inDeg.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id)
    .sort((a, b) => {
      const [aYear, aFmt] = sortKey(a);
      const [bYear, bFmt] = sortKey(b);
      return aYear !== bYear ? aYear - bYear : aFmt - bFmt;
    });

  while (zeroes.length > 0) {
    const n = zeroes.shift()!;
    result.push(n);
    for (const nbr of adj.get(n)!) {
      inDeg.set(nbr, inDeg.get(nbr)! - 1);
      if (inDeg.get(nbr) === 0) {
        // Insert maintaining sort order
        let inserted = false;
        const [nYear, nFmt] = sortKey(nbr);
        for (let i = 0; i < zeroes.length; i++) {
          const [zYear, zFmt] = sortKey(zeroes[i]);
          if (nYear < zYear || (nYear === zYear && nFmt < zFmt)) {
            zeroes.splice(i, 0, nbr);
            inserted = true;
            break;
          }
        }
        if (!inserted) zeroes.push(nbr);
      }
    }
  }

  // Cycle detection: any node never reaching inDegree=0 is in a cycle
  const resultSet = new Set(result);
  const cycleNodes = [...visited.keys()].filter((id) => !resultSet.has(id));

  if (cycleNodes.length > 0) {
    console.error(
      `[franchise-traversal] CYCLE detected in franchise (traversal started from node ${[...visited.keys()][0]}). ` +
      `Nodes involved in cycle (SCC): [${cycleNodes.join(', ')}]. ` +
      `Falling back to pure release-date sort for entire franchise.`
    );
    return [...visited.keys()].sort((a, b) => {
      const [aYear, aFmt] = sortKey(a);
      const [bYear, bFmt] = sortKey(b);
      return aYear !== bYear ? aYear - bYear : aFmt - bFmt;
    });
  }

  return result;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function computeFranchiseWatchOrder(
  startId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<TraversalResult> {
  const { visited, relationType, truncated } = await discoverFranchiseGraph(startId);

  // Singleton or total fetch failure — no franchise to show.
  // truncated is preserved: if visited.size===1 because all neighbor fetches
  // 429'd out, that IS a truncated result (not a genuine singleton).
  // PREQUEL/SEQUEL tie-break: both have strength 0, so whichever path is
  // discovered first wins. Intentional — both render unbadged in the UI.
  // If a downstream consumer ever needs PREQUEL vs SEQUEL distinction, add
  // a secondary tie-break here (e.g. prefer SEQUEL as the forward direction).
  if (visited.size <= 1) {
    return { orderedEntries: [], truncated, rootId: startId };
  }

  const sortedIds = sortFranchise(visited, relationType);

  // Determine franchise root: the earliest entry in the sorted order
  const rootId = sortedIds[0];

  const orderedEntries: FranchiseEntry[] = sortedIds.map((id) => ({
    anilist_id: id,
    relation_type: relationType.get(id) ?? 'ROOT',
  }));

  // Upsert series_metadata for all discovered series as a side effect
  const allDetails = [...visited.values()];
  await upsertSeriesMetadataBatch(supabase, allDetails).catch((err) => {
    console.error('[franchise-traversal] series_metadata upsert failed:', err.message);
  });

  return { orderedEntries, truncated, rootId };
}
