import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase';
import type { PublicProfile, WatchStatus } from '@/lib/types';
import ProfileClient from './profile-client';

const WATCH_STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];

async function getProfile(username: string): Promise<(PublicProfile & { is_public: boolean; owner_user_id: string }) | null> {
  try {
    const supabase = getServiceSupabase();

    const { data: profiles } = await supabase
      .from('profiles')
      .select()
      .eq('username', username)
      .limit(1);

    if (!profiles || profiles.length === 0) return null;

    const profile = profiles[0];
    const userId = profile.user_id as string;
    const hideNsfw = !!(profile.hide_nsfw_public as boolean | undefined);

    // Aggregated counts — exact, no entry cap
    const countQueries = WATCH_STATUSES.map((ws) => {
      let q = supabase
        .from('watchlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('watch_status', ws);
      if (hideNsfw) q = q.eq('is_adult', false).eq('manual_nsfw', false);
      return q;
    });

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

    return {
      username: profile.username as string,
      display_name: (profile.display_name as string) || null,
      joined_at: profile.created_at as string,
      avatar: (profile.avatar as string) || null,
      social_twitter: (profile.social_twitter as string) || null,
      social_discord: (profile.social_discord as string) || null,
      social_instagram: (profile.social_instagram as string) || null,
      social_reddit: (profile.social_reddit as string) || null,
      is_public: !!(profile.is_public),
      owner_user_id: userId,
      stats: {
        total_anime: totalAnime,
        episodes_watched: epCountResult.count ?? 0,
        watching: statusCounts.watching ?? 0,
        completed: statusCounts.completed ?? 0,
        planned: statusCounts.planned ?? 0,
        dropped: statusCounts.dropped ?? 0,
      },
      watchlist: [],
    };
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    return { title: 'User not found' };
  }

  const displayName = profile.display_name || profile.username;
  const totalAnime = profile.stats.total_anime;
  const completed = profile.stats.completed;
  const topStat = completed > 0 ? `${completed} completed` : `${totalAnime} tracked`;
  const description = `Check out ${displayName}'s anime list on Anime Tracker: ${topStat}, ${totalAnime} total.`;

  return {
    title: `${displayName}'s Anime List`,
    description,
    openGraph: {
      title: `${displayName}'s Anime List`,
      description: `${totalAnime} anime tracked. ${topStat}.`,
      type: 'profile',
      url: `https://www.animetracker.lol/u/${profile.username}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName}'s Anime List`,
      description: `${totalAnime} anime tracked. ${topStat}.`,
    },
    alternates: {
      canonical: `https://www.animetracker.lol/u/${profile.username}`,
    },
  };
}

export default async function PublicProfilePage(
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  if (username === 'me') {
    return <ProfileClient profile={null} selfMode />;
  }

  const profile = await getProfile(username);

  if (!profile) {
    notFound();
  }

  return <ProfileClient profile={profile} />;
}
