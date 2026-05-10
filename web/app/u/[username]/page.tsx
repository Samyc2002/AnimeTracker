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

    const [allEntriesRes, watchedEpRes] = await Promise.all([
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

    const allEntriesDocs = allEntriesRes.data || [];
    const watchedEpDocs = watchedEpRes.data || [];

    const epCountMap: Record<number, number> = {};
    for (const doc of watchedEpDocs) {
      const mediaId = doc.media_id as number;
      epCountMap[mediaId] = (epCountMap[mediaId] || 0) + 1;
    }

    const allEntries = allEntriesDocs.map((doc) => ({
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

    const watchlist = hideNsfw ? allEntries.filter((e) => !e.is_nsfw) : allEntries;

    const statusCounts = Object.fromEntries(
      WATCH_STATUSES.map((s) => [s.toLowerCase(), watchlist.filter((e) => e.watch_status === s).length])
    ) as Record<string, number>;

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
        total_anime: watchlist.length,
        episodes_watched: watchedEpDocs.length,
        watching: statusCounts.watching,
        completed: statusCounts.completed,
        planned: statusCounts.planned,
        dropped: statusCounts.dropped,
      },
      watchlist,
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
      // TODO: dynamic OG image once next/og setup is complete
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
