import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCallerUserIdFromRequest } from '@/lib/admin';

export const dynamic = 'force-dynamic';

interface StreamingLink {
  site: string;
  url: string;
}

export async function GET(req: NextRequest) {
  const userId = await getCallerUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const sb = getServiceSupabase();

  const { data: entries, error: entriesErr } = await sb
    .from('watchlist_entries')
    .select('canonical_anilist_id, watch_status')
    .eq('user_id', userId)
    .in('watch_status', ['Watching', 'Planned'])
    .not('canonical_anilist_id', 'is', null);

  if (entriesErr) {
    return NextResponse.json({ error: entriesErr.message }, { status: 500 });
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({ sites: [] });
  }

  const anilistIds = entries.map((e) => e.canonical_anilist_id as number);
  const statusByAnilistId = new Map<number, string>();
  for (const e of entries) {
    statusByAnilistId.set(e.canonical_anilist_id as number, e.watch_status as string);
  }

  const { data: cacheRows, error: cacheErr } = await sb
    .from('anime_cache')
    .select('anilist_id, external_links')
    .in('anilist_id', anilistIds)
    .not('external_links', 'is', null);

  if (cacheErr) {
    return NextResponse.json({ error: cacheErr.message }, { status: 500 });
  }

  const siteCounts: Record<string, { watching: number; planned: number }> = {};

  for (const row of cacheRows ?? []) {
    const links = row.external_links as StreamingLink[] | null;
    if (!Array.isArray(links)) continue;
    const watchStatus = statusByAnilistId.get(row.anilist_id as number);
    if (!watchStatus) continue;
    const bucket = watchStatus === 'Watching' ? 'watching' : 'planned';
    for (const link of links) {
      const entry = (siteCounts[link.site] ??= { watching: 0, planned: 0 });
      entry[bucket]++;
    }
  }

  const sites = Object.entries(siteCounts)
    .map(([site, counts]) => ({ site, ...counts, total: counts.watching + counts.planned }))
    .filter((s) => s.total >= 2)
    .sort((a, b) => b.watching - a.watching || b.planned - a.planned)
    .slice(0, 3);

  return NextResponse.json({ sites });
}
