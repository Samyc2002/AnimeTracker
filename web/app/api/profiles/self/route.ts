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

    // Aggregated counts — exact, no entry cap
    const countQueries = WATCH_STATUSES.map((ws) =>
      supabase
        .from('watchlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('watch_status', ws)
    );

    const epCountQuery = supabase
      .from('watched_episodes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const [countResults, epCountResult] = await Promise.all([
      Promise.all(countQueries),
      epCountQuery,
    ]);

    const statusCounts: Record<string, number> = {};
    let totalAnime = 0;
    for (let i = 0; i < WATCH_STATUSES.length; i++) {
      const c = countResults[i].count ?? 0;
      statusCounts[WATCH_STATUSES[i].toLowerCase()] = c;
      totalAnime += c;
    }

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
        total_anime: totalAnime,
        episodes_watched: epCountResult.count ?? 0,
        watching: statusCounts.watching ?? 0,
        completed: statusCounts.completed ?? 0,
        planned: statusCounts.planned ?? 0,
        dropped: statusCounts.dropped ?? 0,
      },
      watchlist: [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch profile' },
      { status: 500 },
    );
  }
}
