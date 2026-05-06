import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

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

  const batchSize = 10;
  const mode = req.nextUrl.searchParams.get('mode') || 'new';
  const offset = Number(req.nextUrl.searchParams.get('offset') || '0');

  try {
    const supabase = getServiceSupabase();

    const { data: resDocs, error: resError, count: resCount } = await (
      mode === 'full'
        ? supabase.from('watchlist_entries').select('*', { count: 'exact' }).range(offset, offset + batchSize - 1)
        : supabase.from('watchlist_entries').select('*', { count: 'exact' }).is('series_id', null).limit(batchSize)
    );

    if (resError) throw resError;
    const docs = resDocs || [];
    const total = resCount || 0;

    let updated = 0;

    for (const doc of docs) {
      const malId = (doc.id_mal as number) || (doc.media_id as number);
      if (!malId) continue;

      try {
        const seriesId = await resolveSeriesRoot(malId);
        if (seriesId !== (doc.series_id as number | null)) {
          await supabase
            .from('watchlist_entries')
            .update({ series_id: seriesId })
            .eq('id', doc.id);
          updated++;
        }
      } catch {
        // Skip failed entries
      }
    }

    const nextOffset = offset + batchSize;
    const done = mode === 'full'
      ? docs.length < batchSize
      : docs.length === 0 || (total - docs.length) === 0;

    return NextResponse.json({ updated, processed: docs.length, offset, nextOffset, total, mode, done });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backfill failed' },
      { status: 500 },
    );
  }
}
