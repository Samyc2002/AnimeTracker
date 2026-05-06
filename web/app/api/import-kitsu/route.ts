import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchKitsuUserId, fetchKitsuLibrary } from '@/lib/providers/kitsu';
import { mediaToWatchlistEntry } from '@/lib/anime-provider';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data: profiles } = await supabase
      .from('profiles')
      .select('kitsu_username')
      .eq('user_id', userId)
      .limit(1);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const kitsuUsername = profiles[0].kitsu_username as string | null;
    if (!kitsuUsername) {
      return NextResponse.json({ error: 'Kitsu not connected' }, { status: 400 });
    }

    const kitsuUserId = await fetchKitsuUserId(kitsuUsername);
    if (!kitsuUserId) {
      return NextResponse.json({ error: 'Kitsu user not found' }, { status: 404 });
    }

    const kitsuEntries = await fetchKitsuLibrary(kitsuUserId);

    const { data: existingDocs } = await supabase
      .from('watchlist_entries')
      .select('media_id, id')
      .eq('user_id', userId)
      .limit(5000);

    const existingMap = new Map(
      (existingDocs || []).map((d) => [d.media_id as number, d.id as string])
    );

    let created = 0;
    let updated = 0;

    for (const entry of kitsuEntries) {
      const docData = {
        ...mediaToWatchlistEntry(entry.media),
        user_id: userId,
        watch_status: entry.watchStatus,
      };

      const existingDocId = existingMap.get(entry.media.id);

      if (existingDocId) {
        await supabase.from('watchlist_entries').update(docData).eq('id', existingDocId);
        updated++;
      } else {
        await supabase.from('watchlist_entries').insert(docData);
        created++;
      }

      if (entry.progress > 0) {
        const { data: watchedDocs } = await supabase
          .from('watched_episodes')
          .select('episode_number')
          .eq('user_id', userId)
          .eq('media_id', entry.media.id)
          .limit(5000);

        const watchedEps = new Set(
          (watchedDocs || []).map((d) => d.episode_number as number)
        );

        for (let ep = 1; ep <= entry.progress; ep++) {
          if (!watchedEps.has(ep)) {
            await supabase.from('watched_episodes').insert({
              user_id: userId,
              media_id: entry.media.id,
              episode_number: ep,
            });
          }
        }
      }
    }

    return NextResponse.json({ created, updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    );
  }
}
