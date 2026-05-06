import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getOnlineCount } from '@/lib/online-tracker';

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      totalUsersResult,
      totalWatchlistResult,
      totalWatchedEpResult,
      recentWatchlistResult,
      recentWatchedEpResult,
      recentProfilesResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('watchlist_entries').select('*', { count: 'exact', head: true }),
      supabase.from('watched_episodes').select('*', { count: 'exact', head: true }),
      supabase.from('watchlist_entries').select('*', { count: 'exact', head: true }).gt('created_at', sevenDaysAgo),
      supabase.from('watched_episodes').select('*', { count: 'exact', head: true }).gt('created_at', sevenDaysAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('created_at', thirtyDaysAgo),
    ]);

    const totalUsers = totalUsersResult.count || 0;
    const totalWatchlistEntries = totalWatchlistResult.count || 0;
    const totalWatchedEpisodes = totalWatchedEpResult.count || 0;
    const recentWatchlistEntries = recentWatchlistResult.count || 0;
    const recentWatchedEpisodes = recentWatchedEpResult.count || 0;
    const recentProfiles = recentProfilesResult.count || 0;

    const onlineNow = getOnlineCount();

    // Count unique users with activity in last 7 days
    const { data: recentDocs } = await supabase
      .from('watchlist_entries')
      .select('user_id')
      .gt('created_at', sevenDaysAgo)
      .limit(500);

    const activeUserIds = new Set((recentDocs || []).map((d) => (d as unknown as { user_id: string }).user_id));

    const { data: recentEpDocs } = await supabase
      .from('watched_episodes')
      .select('user_id')
      .gt('created_at', sevenDaysAgo)
      .limit(500);

    (recentEpDocs || []).forEach((d) => activeUserIds.add((d as unknown as { user_id: string }).user_id));

    return NextResponse.json({
      online_now: onlineNow,
      totals: {
        users: totalUsers,
        watchlist_entries: totalWatchlistEntries,
        watched_episodes: totalWatchedEpisodes,
      },
      last_7_days: {
        active_users: activeUserIds.size,
        watchlist_adds: recentWatchlistEntries,
        episodes_watched: recentWatchedEpisodes,
      },
      last_30_days: {
        new_signups: recentProfiles,
      },
      generated_at: now.toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch stats' },
      { status: 500 },
    );
  }
}
