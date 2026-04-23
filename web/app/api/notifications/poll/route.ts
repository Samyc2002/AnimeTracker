import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query, ID } from 'node-appwrite';

const ANILIST_API = 'https://graphql.anilist.co';

const AIRING_QUERY = `
query AiringSchedule($mediaIds: [Int], $from: Int, $to: Int) {
  Page(perPage: 50) {
    airingSchedules(
      mediaId_in: $mediaIds,
      airingAt_greater: $from,
      airingAt_lesser: $to
    ) {
      mediaId
      episode
      airingAt
    }
  }
}`;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const watchlistCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;
    const notificationsCol = process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID!;

    const watchlist = await databases.listDocuments(dbId, watchlistCol, [
      Query.equal('user_id', userId),
      Query.limit(500),
    ]);

    const mediaIds = watchlist.documents.map((d) => d.media_id as number);
    if (mediaIds.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;

    const anilistRes = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: AIRING_QUERY,
        variables: { mediaIds, from: oneDayAgo, to: now },
      }),
    });

    if (!anilistRes.ok) {
      return NextResponse.json({ error: 'AniList API error' }, { status: 502 });
    }

    const anilistData = await anilistRes.json();
    const schedules = anilistData.data?.Page?.airingSchedules || [];

    const existing = await databases.listDocuments(dbId, notificationsCol, [
      Query.equal('user_id', userId),
      Query.greaterThan('created_at', new Date(oneDayAgo * 1000).toISOString()),
      Query.limit(500),
    ]);

    const existingKeys = new Set(
      existing.documents.map((d) => `${d.media_id}-${d.episode}`)
    );

    const watchlistMap = new Map(
      watchlist.documents.map((d) => [d.media_id as number, d])
    );

    let created = 0;

    for (const schedule of schedules) {
      const key = `${schedule.mediaId}-${schedule.episode}`;
      if (existingKeys.has(key)) continue;

      const wlEntry = watchlistMap.get(schedule.mediaId);
      if (!wlEntry) continue;

      await databases.createDocument(dbId, notificationsCol, ID.unique(), {
        user_id: userId,
        media_id: schedule.mediaId,
        episode: schedule.episode,
        title: (wlEntry.title_english as string) || (wlEntry.title_romaji as string) || 'Unknown',
        cover_url: wlEntry.cover_url as string,
        airing_at: schedule.airingAt,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      created++;
    }

    return NextResponse.json({ created });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Poll failed' },
      { status: 500 },
    );
  }
}
