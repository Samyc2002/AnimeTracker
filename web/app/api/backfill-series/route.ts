import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';

export const dynamic = 'force-dynamic';

const JIKAN_BASE = 'https://api.jikan.moe/v4';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPrequelId(malId: number): Promise<number | null> {
  try {
    const res = await fetch(`${JIKAN_BASE}/anime/${malId}/relations`, {
      headers: { 'User-Agent': 'AnimeTracker/1.0' },
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    if (!Array.isArray(data)) return null;

    for (const rel of data) {
      if (rel.relation === 'Prequel') {
        for (const entry of rel.entry || []) {
          if (entry.type === 'anime') return entry.mal_id;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveSeriesRoot(malId: number): Promise<number> {
  const visited = new Set<number>();
  let currentId = malId;

  while (true) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    await delay(1000);
    const prequelId = await fetchPrequelId(currentId);
    if (!prequelId) break;
    currentId = prequelId;
  }

  return currentId;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchSize = 5;
  const offset = Number(req.nextUrl.searchParams.get('offset') || '0');

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const watchlistCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;

    const res = await databases.listDocuments(dbId, watchlistCol, [
      Query.limit(batchSize),
      Query.offset(offset),
    ]);

    let updated = 0;

    for (const doc of res.documents) {
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

    const nextOffset = offset + batchSize;
    const done = res.documents.length < batchSize;

    return NextResponse.json({ updated, processed: res.documents.length, offset, nextOffset, total: res.total, done });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backfill failed' },
      { status: 500 },
    );
  }
}
