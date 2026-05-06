import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import type { PublicProfile, PublicProfileEntry, WatchStatus } from '@/lib/types';

const WATCH_STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const supabase = getServiceSupabase();

    const { data: profileDocs, error: profileError } = await supabase
      .from('profiles')
      .select()
      .eq('username', username)
      .eq('is_public', true)
      .limit(1);

    if (profileError) throw profileError;

    if (!profileDocs || profileDocs.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profileDocs[0];
    const userId = profile.user_id as string;
    const hideNsfw = !!(profile.hide_nsfw_public as boolean | undefined);

    const [allEntriesResult, watchedEpResult] = await Promise.all([
      supabase
        .from('watchlist_entries')
        .select()
        .eq('user_id', userId)
        .limit(500),
      supabase
        .from('watched_episodes')
        .select('media_id')
        .eq('user_id', userId)
        .limit(5000),
    ]);

    const allEntriesDocs = allEntriesResult.data || [];
    const watchedEpDocs = watchedEpResult.data || [];

    // Get total count for watched episodes
    const { count: watchedEpTotal } = await supabase
      .from('watched_episodes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const epCountMap: Record<number, number> = {};
    for (const doc of watchedEpDocs) {
      const mediaId = (doc as unknown as { media_id: number }).media_id;
      epCountMap[mediaId] = (epCountMap[mediaId] || 0) + 1;
    }

    const allEntries: PublicProfileEntry[] = allEntriesDocs.map((doc) => {
      const d = doc as unknown as {
        media_id: number;
        title_romaji: string;
        title_english: string;
        cover_url: string;
        status: string;
        total_episodes: number | null;
        watch_status?: WatchStatus;
        is_adult?: boolean;
        manual_nsfw?: boolean;
      };
      return {
        media_id: d.media_id,
        title_romaji: d.title_romaji,
        title_english: d.title_english,
        cover_url: d.cover_url,
        status: d.status,
        total_episodes: d.total_episodes,
        watch_status: d.watch_status || 'Watching',
        episodes_watched: epCountMap[d.media_id] || 0,
        is_nsfw: !!(d.is_adult || d.manual_nsfw),
      };
    });

    const watchlist = hideNsfw
      ? allEntries.filter((e) => !e.is_nsfw)
      : allEntries;

    const statusCounts = Object.fromEntries(
      WATCH_STATUSES.map((s) => [s.toLowerCase(), watchlist.filter((e) => e.watch_status === s).length])
    ) as Record<string, number>;

    const result: PublicProfile = {
      username: profile.username as string,
      display_name: (profile.display_name as string) || null,
      joined_at: profile.created_at as string,
      avatar: (profile.avatar as string) || null,
      social_twitter: (profile.social_twitter as string) || null,
      social_discord: (profile.social_discord as string) || null,
      social_instagram: (profile.social_instagram as string) || null,
      social_reddit: (profile.social_reddit as string) || null,
      stats: {
        total_anime: watchlist.length,
        episodes_watched: watchedEpTotal || 0,
        watching: statusCounts.watching,
        completed: statusCounts.completed,
        planned: statusCounts.planned,
        dropped: statusCounts.dropped,
      },
      watchlist,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
