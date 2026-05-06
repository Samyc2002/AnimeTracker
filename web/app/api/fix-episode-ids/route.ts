import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get all watchlist entries with id_mal set
  const { data: wlEntries } = await supabase
    .from('watchlist_entries')
    .select('user_id, media_id, id_mal')
    .not('id_mal', 'is', null)
    .limit(10000);

  if (!wlEntries || wlEntries.length === 0) {
    return NextResponse.json({ message: 'No entries with id_mal found', fixed: 0 });
  }

  let fixed = 0;

  for (const entry of wlEntries) {
    const malId = entry.id_mal as number;
    const anilistId = entry.media_id as number;
    const userId = entry.user_id as string;

    if (malId === anilistId) continue;

    // Find watched_episodes stored under the MAL ID
    const { data: mismatchedEps } = await supabase
      .from('watched_episodes')
      .select('id')
      .eq('user_id', userId)
      .eq('media_id', malId)
      .limit(5000);

    if (!mismatchedEps || mismatchedEps.length === 0) continue;

    // Update them to use the AniList media_id
    for (const ep of mismatchedEps) {
      await supabase
        .from('watched_episodes')
        .update({ media_id: anilistId })
        .eq('id', ep.id);
      fixed++;
    }
  }

  return NextResponse.json({ fixed });
}
