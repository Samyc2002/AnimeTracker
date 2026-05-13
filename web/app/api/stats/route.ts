import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getOnlineCount } from '@/lib/online-tracker';

const statsCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  day.setDate(day.getDate() - day.getDay());
  return day;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weeksAgoLabel(weeksAgo: number): string {
  if (weeksAgo === 0) return 'This week';
  if (weeksAgo === 1) return '1 week ago';
  return `${weeksAgo} weeks ago`;
}

interface ActivityRow { user_id: string; created_at: string }
interface ProfileRow { user_id: string; created_at: string }
interface WatchlistRow { user_id: string; created_at: string; watch_status: string; import_source: string; canonical_anilist_id: number | null }
interface WatchOrderRow { computed_at: string }

function computeEngagement(
  watchlist: ActivityRow[],
  episodes: ActivityRow[],
  now: Date,
) {
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const all = [...watchlist, ...episodes];
  const active1d = new Set(all.filter(r => r.created_at > oneDayAgo).map(r => r.user_id));
  const active7d = new Set(all.filter(r => r.created_at > sevenDaysAgo).map(r => r.user_id));
  const active30d = new Set(all.filter(r => r.created_at > thirtyDaysAgo).map(r => r.user_id));

  const stickiness_pct = active30d.size > 0
    ? Math.round((active1d.size / active30d.size) * 1000) / 10
    : 0;

  return {
    active_1d: active1d.size,
    active_7d: active7d.size,
    active_30d: active30d.size,
    stickiness_pct,
  };
}

function computeRetentionCohorts(
  profiles: ProfileRow[],
  watchlist: ActivityRow[],
  episodes: ActivityRow[],
  now: Date,
) {
  const thisWeekStart = startOfWeek(now);

  const activityByUser = new Map<string, Date[]>();
  for (const r of [...watchlist, ...episodes]) {
    const dates = activityByUser.get(r.user_id) || [];
    dates.push(new Date(r.created_at));
    activityByUser.set(r.user_id, dates);
  }

  const cohorts: Array<{
    label: string;
    cohort_size: number;
    week_1_pct: number | null;
    week_2_pct: number | null;
    week_3_pct: number | null;
    week_4_pct: number | null;
    week_1_count: number | null;
    week_2_count: number | null;
    week_3_count: number | null;
    week_4_count: number | null;
  }> = [];

  for (let weeksAgo = 0; weeksAgo < 5; weeksAgo++) {
    const cohortStart = new Date(thisWeekStart);
    cohortStart.setDate(cohortStart.getDate() - weeksAgo * 7);
    const cohortEnd = new Date(cohortStart);
    cohortEnd.setDate(cohortEnd.getDate() + 7);

    const cohortUsers = profiles.filter(p => {
      const signup = new Date(p.created_at);
      return signup >= cohortStart && signup < cohortEnd;
    });

    const weekData: (number | null)[] = [];
    const weekCounts: (number | null)[] = [];

    for (let w = 1; w <= 4; w++) {
      const windowStart = new Date(cohortStart);
      windowStart.setDate(windowStart.getDate() + w * 7);
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 7);

      if (windowStart > now) {
        weekData.push(null);
        weekCounts.push(null);
        continue;
      }

      let returnedCount = 0;
      for (const user of cohortUsers) {
        const dates = activityByUser.get(user.user_id) || [];
        const hasActivity = dates.some(d => d >= windowStart && d < windowEnd);
        if (hasActivity) returnedCount++;
      }

      weekCounts.push(returnedCount);
      weekData.push(cohortUsers.length > 0
        ? Math.round((returnedCount / cohortUsers.length) * 100)
        : null);
    }

    cohorts.push({
      label: weeksAgo < 4 ? weeksAgoLabel(weeksAgo) : '4+ weeks ago',
      cohort_size: cohortUsers.length,
      week_1_pct: weekData[0],
      week_2_pct: weekData[1],
      week_3_pct: weekData[2],
      week_4_pct: weekData[3],
      week_1_count: weekCounts[0],
      week_2_count: weekCounts[1],
      week_3_count: weekCounts[2],
      week_4_count: weekCounts[3],
    });
  }

  return cohorts;
}

function computeGrowthFunnel(
  profiles: ProfileRow[],
  watchlist: ActivityRow[],
  episodes: ActivityRow[],
  now: Date,
) {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentSignups = profiles.filter(p => new Date(p.created_at) >= thirtyDaysAgo);
  const recentUserIds = new Set(recentSignups.map(p => p.user_id));

  const entriesByUser = new Map<string, number>();
  for (const w of watchlist) {
    if (!recentUserIds.has(w.user_id)) continue;
    entriesByUser.set(w.user_id, (entriesByUser.get(w.user_id) || 0) + 1);
  }

  const added1 = [...entriesByUser.entries()].filter(([, c]) => c >= 1).length;
  const added3 = [...entriesByUser.entries()].filter(([, c]) => c >= 3).length;

  const allActivity = [...watchlist, ...episodes];
  let returned7d = 0;
  for (const signup of recentSignups) {
    const signupDate = new Date(signup.created_at);
    const returnWindowStart = new Date(signupDate.getTime() + 24 * 60 * 60 * 1000);
    const returnWindowEnd = new Date(signupDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (returnWindowEnd > now) continue;
    const hasReturn = allActivity.some(a =>
      a.user_id === signup.user_id &&
      new Date(a.created_at) >= returnWindowStart &&
      new Date(a.created_at) <= returnWindowEnd
    );
    if (hasReturn) returned7d++;
  }

  const activeRecently = new Set(
    allActivity
      .filter(a => new Date(a.created_at) >= sevenDaysAgo && recentUserIds.has(a.user_id))
      .map(a => a.user_id)
  );

  return {
    signed_up: recentSignups.length,
    added_1: added1,
    added_3: added3,
    returned_7d: returned7d,
    active_7d: activeRecently.size,
  };
}

function computeDAUChart(
  watchlist: ActivityRow[],
  episodes: ActivityRow[],
  now: Date,
) {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const result: Array<{ date: string; count: number }> = [];

  for (let i = 29; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const dayStr = formatDate(startOfDay(day));

    const userIds = new Set<string>();
    for (const r of watchlist) {
      if (formatDate(startOfDay(new Date(r.created_at))) === dayStr &&
          new Date(r.created_at) >= thirtyDaysAgo) {
        userIds.add(r.user_id);
      }
    }
    for (const r of episodes) {
      if (formatDate(startOfDay(new Date(r.created_at))) === dayStr &&
          new Date(r.created_at) >= thirtyDaysAgo) {
        userIds.add(r.user_id);
      }
    }
    result.push({ date: dayStr, count: userIds.size });
  }

  return result;
}

function computeSignupsChart(profiles: ProfileRow[], now: Date) {
  const result: Array<{ date: string; count: number }> = [];
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const countsByDate = new Map<string, number>();
  for (const p of profiles) {
    if (new Date(p.created_at) < thirtyDaysAgo) continue;
    const d = formatDate(startOfDay(new Date(p.created_at)));
    countsByDate.set(d, (countsByDate.get(d) || 0) + 1);
  }

  for (let i = 29; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const dayStr = formatDate(startOfDay(day));
    result.push({ date: dayStr, count: countsByDate.get(dayStr) || 0 });
  }

  return result;
}

export async function GET() {
  const cached = statsCache.get('global');
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const supabase = getServiceSupabase();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const [
      totalUsersResult,
      totalWatchlistResult,
      totalWatchedEpResult,
      recentWatchlistResult,
      recentWatchedEpResult,
      recentProfilesResult,
      allProfiles,
      recentWatchlist,
      recentEpisodes,
      allWatchlistForAdoption,
      playlistUsers,
      unlockedAchievements,
      foundingMembers,
      franchiseMembership,
      watchOrderRows,
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('watchlist_entries').select('*', { count: 'exact', head: true }),
      supabase.from('watched_episodes').select('*', { count: 'exact', head: true }),
      supabase.from('watchlist_entries').select('*', { count: 'exact', head: true }).gt('created_at', sevenDaysAgo),
      supabase.from('watched_episodes').select('*', { count: 'exact', head: true }).gt('created_at', sevenDaysAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('created_at', thirtyDaysAgo),
      supabase.from('profiles').select('user_id, created_at'),
      supabase.from('watchlist_entries').select('user_id, created_at, watch_status, import_source, canonical_anilist_id').gt('created_at', sixtyDaysAgo),
      supabase.from('watched_episodes').select('user_id, created_at').gt('created_at', sixtyDaysAgo),
      supabase.from('watchlist_entries').select('user_id, import_source, canonical_anilist_id'),
      supabase.from('playlists').select('user_id'),
      supabase.from('user_achievements').select('user_id, achievement_id').eq('unlocked', true),
      supabase.from('user_achievements').select('user_id').eq('achievement_id', 'founding_member').eq('unlocked', true),
      supabase.from('franchise_membership').select('series_anilist_id'),
      supabase.from('franchise_watch_orders').select('computed_at').gt('computed_at', thirtyDaysAgo).not('computed_at', 'is', null),
    ]);

    const totalUsers = totalUsersResult.count || 0;
    const totalWatchlistEntries = totalWatchlistResult.count || 0;
    const totalWatchedEpisodes = totalWatchedEpResult.count || 0;
    const recentWatchlistEntries = recentWatchlistResult.count || 0;
    const recentWatchedEpisodes = recentWatchedEpResult.count || 0;
    const recentProfileCount = recentProfilesResult.count || 0;
    const onlineNow = getOnlineCount();

    const profiles = (allProfiles.data || []) as ProfileRow[];
    const watchlist = (recentWatchlist.data || []) as unknown as WatchlistRow[];
    const episodes = (recentEpisodes.data || []) as ActivityRow[];
    const watchlistActivity: ActivityRow[] = watchlist.map(w => ({
      user_id: w.user_id,
      created_at: w.created_at,
    }));

    // Active users for existing 7d metric
    const activeUserIds = new Set<string>();
    const { data: recentDocs } = await supabase
      .from('watchlist_entries')
      .select('user_id')
      .gt('created_at', sevenDaysAgo)
      .limit(500);
    (recentDocs || []).forEach((d) => activeUserIds.add((d as unknown as { user_id: string }).user_id));
    const { data: recentEpDocs } = await supabase
      .from('watched_episodes')
      .select('user_id')
      .gt('created_at', sevenDaysAgo)
      .limit(500);
    (recentEpDocs || []).forEach((d) => activeUserIds.add((d as unknown as { user_id: string }).user_id));

    // Engagement
    const engagement = computeEngagement(watchlistActivity, episodes, now);

    // Retention cohorts
    const retention_cohorts = computeRetentionCohorts(profiles, watchlistActivity, episodes, now);

    // Feature adoption
    const allWatchlistData = (allWatchlistForAdoption.data || []) as unknown as WatchlistRow[];
    const franchiseIds = new Set((franchiseMembership.data || []).map(
      (r: { series_anilist_id: number }) => r.series_anilist_id
    ));

    const adoptionMetrics: Array<{ feature: string; count: number; pct: number }> = [];
    const addMetric = (feature: string, userIds: Set<string>) => {
      adoptionMetrics.push({
        feature,
        count: userIds.size,
        pct: totalUsers > 0 ? Math.round((userIds.size / totalUsers) * 1000) / 10 : 0,
      });
    };

    addMetric('Added to watchlist', new Set(allWatchlistData.map(w => w.user_id)));
    addMetric('Imported from AniList', new Set(
      allWatchlistData.filter(w => w.import_source === 'anilist').map(w => w.user_id)
    ));
    addMetric('Imported from Kitsu', new Set(
      allWatchlistData.filter(w => w.import_source === 'kitsu').map(w => w.user_id)
    ));
    addMetric('Used watch order', new Set(
      allWatchlistData
        .filter(w => w.canonical_anilist_id && franchiseIds.has(w.canonical_anilist_id))
        .map(w => w.user_id)
    ));
    addMetric('Created a playlist', new Set(
      ((playlistUsers.data || []) as unknown as { user_id: string }[]).map(r => r.user_id)
    ));
    addMetric('Earned an achievement', new Set(
      ((unlockedAchievements.data || []) as unknown as { user_id: string }[]).map(r => r.user_id)
    ));
    addMetric('Earned Founding Member', new Set(
      ((foundingMembers.data || []) as unknown as { user_id: string }[]).map(r => r.user_id)
    ));

    adoptionMetrics.sort((a, b) => b.pct - a.pct);

    // Growth funnel
    const growth_funnel = computeGrowthFunnel(profiles, watchlistActivity, episodes, now);

    // Charts
    const dau_30d = computeDAUChart(watchlistActivity, episodes, now);
    const signups_30d = computeSignupsChart(profiles, now);

    const statusCounts = new Map<string, number>();
    for (const w of allWatchlistData) {
      const status = w.watch_status || 'Unknown';
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    }
    const watchlist_status_distribution = [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const watchOrderCounts = new Map<string, number>();
    for (const r of (watchOrderRows.data || []) as unknown as WatchOrderRow[]) {
      const d = formatDate(startOfDay(new Date(r.computed_at)));
      watchOrderCounts.set(d, (watchOrderCounts.get(d) || 0) + 1);
    }
    const watch_order_30d: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const dayStr = formatDate(startOfDay(day));
      watch_order_30d.push({ date: dayStr, count: watchOrderCounts.get(dayStr) || 0 });
    }

    const response = {
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
        new_signups: recentProfileCount,
      },
      engagement,
      retention_cohorts,
      feature_adoption: adoptionMetrics,
      growth_funnel,
      charts: {
        dau_30d,
        signups_30d,
        watchlist_status_distribution,
        watch_order_30d,
      },
      generated_at: now.toISOString(),
    };

    statsCache.set('global', { data: response, ts: Date.now() });

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch stats' },
      { status: 500 },
    );
  }
}
