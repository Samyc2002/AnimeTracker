import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Client, Databases, Query } from 'node-appwrite';
import type { PublicProfile, WatchStatus } from '@/lib/types';
import ProfileClient from './profile-client';

const WATCH_STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];

function getServerDb() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

async function getProfile(username: string): Promise<PublicProfile | null> {
  try {
    const databases = getServerDb();
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const profilesCol = process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID!;
    const watchlistCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;
    const watchedEpCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHED_EPISODES_COLLECTION_ID!;

    const profileRes = await databases.listDocuments(dbId, profilesCol, [
      Query.equal('username', username),
      Query.equal('is_public', true),
      Query.limit(1),
    ]);

    if (profileRes.documents.length === 0) return null;

    const profile = profileRes.documents[0];
    const userId = profile.user_id as string;
    const hideNsfw = !!(profile.hide_nsfw_public as boolean | undefined);

    const [allEntriesRes, watchedEpRes] = await Promise.all([
      databases.listDocuments(dbId, watchlistCol, [
        Query.equal('user_id', userId),
        Query.limit(500),
      ]),
      databases.listDocuments(dbId, watchedEpCol, [
        Query.equal('user_id', userId),
        Query.select(['media_id']),
        Query.limit(5000),
      ]),
    ]);

    const epCountMap: Record<number, number> = {};
    for (const doc of watchedEpRes.documents) {
      const mediaId = doc.media_id as number;
      epCountMap[mediaId] = (epCountMap[mediaId] || 0) + 1;
    }

    const allEntries = allEntriesRes.documents.map((doc) => ({
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
      joined_at: profile.$createdAt as string,
      avatar: (profile.avatar as string) || null,
      social_twitter: (profile.social_twitter as string) || null,
      social_discord: (profile.social_discord as string) || null,
      social_instagram: (profile.social_instagram as string) || null,
      social_reddit: (profile.social_reddit as string) || null,
      stats: {
        total_anime: watchlist.length,
        episodes_watched: watchedEpRes.total,
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
  const description = `Check out ${displayName}'s anime list on Anime Tracker — ${topStat}, ${totalAnime} total.`;

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
  const profile = await getProfile(username);

  if (!profile) {
    notFound();
  }

  return <ProfileClient profile={profile} />;
}
