import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchUserList, mediaToWatchlistEntry, ANILIST_STATUS_MAP } from '@/lib/anime-provider';
import { fireAchievementEvent } from '@/lib/achievements/engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data: profileDocs } = await supabase
      .from('profiles')
      .select()
      .eq('user_id', userId)
      .limit(1);

    if (!profileDocs || profileDocs.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profileDocs[0];
    const anilistUserId = profile.anilist_user_id as number | null;
    const anilistToken = profile.anilist_token as string | null;

    if (!anilistUserId || !anilistToken) {
      return NextResponse.json({ error: 'AniList not connected' }, { status: 400 });
    }

    const anilistEntries = await fetchUserList(anilistUserId, anilistToken);

    const { data: existingDocs } = await supabase
      .from('watchlist_entries')
      .select('media_id, id')
      .eq('user_id', userId)
      .limit(500);

    const existingMap = new Map(
      (existingDocs || []).map((d) => [d.media_id as number, d.id as string])
    );

    let created = 0;
    let updated = 0;

    for (const entry of anilistEntries) {
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
          .select()
          .eq('user_id', userId)
          .eq('media_id', entry.media.id)
          .limit(5000);

        const watchedEps = new Set(
          (watchedDocs || []).map((d) => d.episode_number as number)
        );

        for (let ep = 1; ep <= entry.progress; ep++) {
          if (!watchedEps.has(ep)) {
            await supabase.from('watched_episodes').upsert({
              user_id: userId,
              media_id: entry.media.id,
              episode_number: ep,
            });
          }
        }
      }
    }

    fireAchievementEvent(userId, 'import_complete', supabase).catch(() => {});

    return NextResponse.json({ created, updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    );
  }
}
