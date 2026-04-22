import { NextResponse } from 'next/server';
import { Client, Databases, Query, Users } from 'node-appwrite';

function getServerClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  return {
    databases: new Databases(client),
    users: new Users(client),
  };
}

export async function GET() {
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'APPWRITE_API_KEY not configured' }, { status: 500 });
  }

  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const watchlistCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;
  const watchedEpCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHED_EPISODES_COLLECTION_ID!;
  const profilesCol = process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID!;

  try {
    const { databases, users } = getServerClient();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      totalUsers,
      totalWatchlistEntries,
      totalWatchedEpisodes,
      recentWatchlistEntries,
      recentWatchedEpisodes,
      recentProfiles,
    ] = await Promise.all([
      users.list().then((r) => r.total),
      databases.listDocuments(dbId, watchlistCol, [Query.limit(1)]).then((r) => r.total),
      databases.listDocuments(dbId, watchedEpCol, [Query.limit(1)]).then((r) => r.total),
      databases.listDocuments(dbId, watchlistCol, [
        Query.greaterThan('$createdAt', sevenDaysAgo),
        Query.limit(1),
      ]).then((r) => r.total),
      databases.listDocuments(dbId, watchedEpCol, [
        Query.greaterThan('$createdAt', sevenDaysAgo),
        Query.limit(1),
      ]).then((r) => r.total),
      databases.listDocuments(dbId, profilesCol, [
        Query.greaterThan('$createdAt', thirtyDaysAgo),
        Query.limit(1),
      ]).then((r) => r.total),
    ]);

    // Count unique users with activity in last 5 minutes (online now)
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const [onlineWl, onlineEp] = await Promise.all([
      databases.listDocuments(dbId, watchlistCol, [
        Query.greaterThan('$updatedAt', fiveMinAgo),
        Query.select(['user_id']),
        Query.limit(500),
      ]),
      databases.listDocuments(dbId, watchedEpCol, [
        Query.greaterThan('$createdAt', fiveMinAgo),
        Query.select(['user_id']),
        Query.limit(500),
      ]),
    ]);
    const onlineUserIds = new Set<string>();
    onlineWl.documents.forEach((d) => onlineUserIds.add((d as unknown as { user_id: string }).user_id));
    onlineEp.documents.forEach((d) => onlineUserIds.add((d as unknown as { user_id: string }).user_id));

    // Count unique users with activity in last 7 days
    const recentDocs = await databases.listDocuments(dbId, watchlistCol, [
      Query.greaterThan('$createdAt', sevenDaysAgo),
      Query.select(['user_id']),
      Query.limit(500),
    ]);
    const activeUserIds = new Set(recentDocs.documents.map((d) => (d as unknown as { user_id: string }).user_id));

    const recentEpDocs = await databases.listDocuments(dbId, watchedEpCol, [
      Query.greaterThan('$createdAt', sevenDaysAgo),
      Query.select(['user_id']),
      Query.limit(500),
    ]);
    recentEpDocs.documents.forEach((d) => activeUserIds.add((d as unknown as { user_id: string }).user_id));

    return NextResponse.json({
      online_now: onlineUserIds.size,
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
