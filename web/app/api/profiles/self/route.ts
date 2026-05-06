import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import type { WatchStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const WATCH_STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    const { data: profiles } = await supabase
      .from('profiles')
      .select()
      .eq('user_id', userId)
      .limit(1);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profiles[0];

    const [entriesRes, epRes] = await Promise.all([
      supabase.from('watchlist_entries').select().eq('user_id', userId).limit(500),
      supabase.from('watched_episodes').select('media_id').eq('user_id', userId).limit(5000),
    ]);

    const entries = entriesRes.data || [];
    const epDocs = epRes.data || [];

    const epCountMap: Record<number, number> = {};
    for (const doc of epDocs) {
      const mediaId = doc.media_id as number;
      epCountMap[mediaId] = (epCountMap[mediaId] || 0) + 1;
    }

    const watchlist = entries.map((doc) => ({
      media_id: doc.media_id as number,
      title_romaji: doc.title_romaji as string,
      title_english: doc.title_english as string,
      cover_url: doc.cover_url as string,
      status: doc.status as string,
      total_episodes: doc.total_episodes as number | null,
      watch_status: (doc.watch_status as WatchStatus) || 'Watching',
      episodes_watched: epCountMap[doc.media_id as number] || 0,
      is_nsfw: !!(doc.is_adult || doc.manual_nsfw),
    }));

    const statusCounts = Object.fromEntries(
      WATCH_STATUSES.map((s) => [s.toLowerCase(), watchlist.filter((e) => e.watch_status === s).length])
    ) as Record<string, number>;

    return NextResponse.json({
      username: (profile.username as string) || 'me',
      display_name: (profile.display_name as string) || null,
      joined_at: profile.created_at as string,
      avatar: (profile.avatar as string) || null,
      social_twitter: (profile.social_twitter as string) || null,
      social_discord: (profile.social_discord as string) || null,
      social_instagram: (profile.social_instagram as string) || null,
      social_reddit: (profile.social_reddit as string) || null,
      stats: {
        total_anime: watchlist.length,
        episodes_watched: epDocs.length,
        watching: statusCounts.watching,
        completed: statusCounts.completed,
        planned: statusCounts.planned,
        dropped: statusCounts.dropped,
      },
      watchlist,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch profile' },
      { status: 500 },
    );
  }
}
