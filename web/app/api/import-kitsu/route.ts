import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchKitsuUserId, fetchKitsuLibrary } from '@/lib/providers/kitsu';
import { mediaToWatchlistEntry } from '@/lib/anime-provider';
import { fireAchievementEvent } from '@/lib/achievements/engine';
import { resolveKitsuToAniList } from '@/lib/providers/kitsu-resolve';
import { upsertSeriesMetadataBatch } from '@/lib/series-metadata';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
      return NextResponse.json({ error: `Kitsu user "${kitsuUsername}" not found. Check the username and try again.` }, { status: 404 });
    }

    const kitsuEntries = await fetchKitsuLibrary(kitsuUserId);

    if (kitsuEntries.length === 0) {
      return NextResponse.json({
        error: 'No anime found in Kitsu library. The library may be private, empty, or Kitsu may be temporarily unavailable.',
        possiblePrivate: true,
      }, { status: 404 });
    }

    // Resolve Kitsu IDs → canonical AniList IDs before writing
    const kitsuIds = kitsuEntries.map((e) => e.media.id);
    const resolutions = await resolveKitsuToAniList(kitsuIds);
    const kitsuToAniList = new Map(resolutions.map((r) => [r.kitsuId, r.anilistId]));

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
    let skipped = 0;

    for (const entry of kitsuEntries) {
      const canonicalAnilistId = kitsuToAniList.get(entry.media.id) ?? null;
      const docData = {
        ...mediaToWatchlistEntry(entry.media),
        user_id: userId,
        watch_status: entry.watchStatus,
        import_source: 'kitsu',
        canonical_anilist_id: canonicalAnilistId,
      };

      const existingDocId = existingMap.get(entry.media.id);

      if (existingDocId) {
        // Don't overwrite watch_status — preserve what the user set in-app
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { watch_status: _ws, ...updateData } = docData;
        await supabase.from('watchlist_entries').update(updateData).eq('id', existingDocId);
        updated++;
      } else {
        const { error } = await supabase.from('watchlist_entries').insert(docData);
        if (error?.code === '23505') {
          skipped++;
        } else if (error) {
          throw error;
        } else {
          created++;
        }
      }

      if (entry.progress > 0) {
        const rows = Array.from({ length: entry.progress }, (_, i) => ({
          user_id: userId,
          media_id: entry.media.id,
          episode_number: i + 1,
        }));
        await supabase.from('watched_episodes').upsert(rows, { onConflict: 'user_id,media_id,episode_number' });
      }
    }

    // Batch upsert series metadata — resolved entries carry full AniList metadata from the MAL batch query
    const resolvedMedia = resolutions.filter((r) => r.media !== null).map((r) => r.media!);
    if (resolvedMedia.length > 0) await upsertSeriesMetadataBatch(supabase, resolvedMedia);

    // Record import timestamp for re-import warning
    await supabase.from('profiles').update({ kitsu_imported_at: new Date().toISOString() }).eq('user_id', userId);

    // Sequential — prevents race condition where both events unlock the same achievement before either write commits
    fireAchievementEvent(userId, 'import_complete', supabase)
      .then(() => fireAchievementEvent(userId, 'watchlist_add', supabase))
      .catch(() => {});

    return NextResponse.json({ created, updated, skipped, total: kitsuEntries.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    );
  }
}
