import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';
import type { PublicProfile, PublicProfileEntry, WatchStatus } from '@/lib/types';

const WATCH_STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];

function getServerClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const databases = getServerClient();
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const profilesCol = process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID!;
    const allEntriesCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;
    const watchedEpCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHED_EPISODES_COLLECTION_ID!;

    const profileRes = await databases.listDocuments(dbId, profilesCol, [
      Query.equal('username', username),
      Query.equal('is_public', true),
      Query.limit(1),
    ]);

    if (profileRes.documents.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profileRes.documents[0];
    const userId = profile.user_id as string;
    const hideNsfw = !!(profile.hide_nsfw_public as boolean | undefined);

    const [allEntriesRes, watchedEpRes] = await Promise.all([
      databases.listDocuments(dbId, allEntriesCol, [
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
      const mediaId = (doc as unknown as { media_id: number }).media_id;
      epCountMap[mediaId] = (epCountMap[mediaId] || 0) + 1;
    }

    const allEntries: PublicProfileEntry[] = allEntriesRes.documents.map((doc) => {
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

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
