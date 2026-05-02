import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';

export const dynamic = 'force-dynamic';

const JIKAN_BASE = 'https://api.jikan.moe/v4';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRelations(malId: number): Promise<number[]> {
  try {
    const res = await fetch(`${JIKAN_BASE}/anime/${malId}/full`, {
      headers: { 'User-Agent': 'AnimeTracker/1.0' },
    });
    if (!res.ok) return [];
    const { data } = await res.json();
    if (!data?.relations) return [];

    const prequelIds: number[] = [];
    for (const rel of data.relations) {
      if (rel.relation === 'Prequel') {
        for (const entry of rel.entry || []) {
          if (entry.type === 'anime') prequelIds.push(entry.mal_id);
        }
      }
    }
    return prequelIds;
  } catch {
    return [];
  }
}

async function resolveSeriesRoot(malId: number): Promise<number> {
  const visited = new Set<number>();
  let currentId = malId;

  while (true) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    await delay(1000);
    const prequelIds = await fetchRelations(currentId);
    if (prequelIds.length === 0) break;
    currentId = prequelIds[0];
  }

  return currentId;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const watchlistCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;

    let offset = 0;
    let updated = 0;
    let processed = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await databases.listDocuments(dbId, watchlistCol, [
        Query.limit(100),
        Query.offset(offset),
      ]);

      for (const doc of res.documents) {
        processed++;
        const malId = (doc.id_mal as number) || (doc.media_id as number);
        if (!malId) continue;

        try {
          const seriesId = await resolveSeriesRoot(malId);
          if (seriesId !== (doc.series_id as number | null)) {
            await databases.updateDocument(dbId, watchlistCol, doc.$id, {
              series_id: seriesId,
            });
            updated++;
          }
        } catch {
          // Skip failed entries
        }
      }

      offset += 100;
      hasMore = res.documents.length === 100;
    }

    return NextResponse.json({ processed, updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backfill failed' },
      { status: 500 },
    );
  }
}
