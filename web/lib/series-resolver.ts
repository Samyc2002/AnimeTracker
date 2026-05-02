import { fetchAnimeDetail } from '@/lib/anime-provider';

const seriesIdCache = new Map<number, number>();

export async function getSeriesId(animeId: number): Promise<number> {
  if (seriesIdCache.has(animeId)) return seriesIdCache.get(animeId)!;

  const visited = new Set<number>();
  let currentId = animeId;

  while (true) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    try {
      const detail = await fetchAnimeDetail(currentId);
      const prequelEdge = detail.relations?.edges?.find(
        (e) => e.relationType === 'PREQUEL' && e.node.type === 'ANIME'
      );

      if (!prequelEdge) break;
      currentId = prequelEdge.node.id;
    } catch {
      break;
    }
  }

  for (const id of visited) {
    seriesIdCache.set(id, currentId);
  }

  return currentId;
}

export async function backfillSeriesId(
  docId: string,
  animeId: number,
  updateFn: (docId: string, data: Record<string, unknown>) => Promise<unknown>,
): Promise<void> {
  try {
    const seriesId = await getSeriesId(animeId);
    await updateFn(docId, { series_id: seriesId });
  } catch {
    // Non-critical — entry works without series_id
  }
}
