import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query, ID } from 'node-appwrite';

export const dynamic = 'force-dynamic';

const ANILIST_API = 'https://graphql.anilist.co';

const BATCH_RELATIONS_QUERY = `
query BatchRelations($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      relations {
        edges {
          relationType
          node {
            id
            title { romaji english }
            coverImage { extraLarge large medium }
            type
            status
          }
        }
      }
    }
  }
}`;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SequelInfo {
  id: number;
  title: string;
  coverUrl: string;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchSize = 100;
  const offset = Number(req.nextUrl.searchParams.get('offset') || '0');

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const watchlistCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;
    const notificationsCol = process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID!;

    const res = await databases.listDocuments(dbId, watchlistCol, [
      Query.equal('watch_status', 'Completed'),
      Query.limit(batchSize),
      Query.offset(offset),
      Query.select(['user_id', 'media_id']),
    ]);

    if (res.documents.length === 0) {
      return NextResponse.json({ processed: 0, created: 0, offset, done: true });
    }

    const userMediaMap = new Map<string, number[]>();
    for (const doc of res.documents) {
      const userId = doc.user_id as string;
      const mediaId = doc.media_id as number;
      if (!userMediaMap.has(userId)) userMediaMap.set(userId, []);
      userMediaMap.get(userId)!.push(mediaId);
    }

    let created = 0;

    for (const [userId, mediaIds] of userMediaMap) {
      const uniqueIds = [...new Set(mediaIds)];

      const allWatchlist = await databases.listDocuments(dbId, watchlistCol, [
        Query.equal('user_id', userId),
        Query.limit(500),
        Query.select(['media_id']),
      ]);
      const trackedMediaIds = new Set(allWatchlist.documents.map((d) => d.media_id as number));

      for (let i = 0; i < uniqueIds.length; i += 50) {
        const batch = uniqueIds.slice(i, i + 50);

        const anilistRes = await fetch(ANILIST_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: BATCH_RELATIONS_QUERY,
            variables: { ids: batch },
          }),
        });

        if (!anilistRes.ok) {
          if (anilistRes.status === 429) {
            await delay(60_000);
            i -= 50;
            continue;
          }
          continue;
        }

        const data = await anilistRes.json();
        const mediaList = data.data?.Page?.media || [];

        const sequels: SequelInfo[] = [];

        for (const media of mediaList) {
          for (const edge of media.relations?.edges || []) {
            if (
              edge.relationType === 'SEQUEL' &&
              edge.node.type === 'ANIME' &&
              edge.node.status === 'NOT_YET_RELEASED'
            ) {
              sequels.push({
                id: edge.node.id,
                title: edge.node.title?.english || edge.node.title?.romaji || 'Unknown',
                coverUrl: edge.node.coverImage?.extraLarge || edge.node.coverImage?.large || edge.node.coverImage?.medium || '',
              });
            }
          }
        }

        for (const sequel of sequels) {
          if (trackedMediaIds.has(sequel.id)) continue;

          const existing = await databases.listDocuments(dbId, notificationsCol, [
            Query.equal('user_id', userId),
            Query.equal('media_id', sequel.id),
            Query.equal('type', 'sequel'),
            Query.limit(1),
          ]);

          if (existing.total > 0) continue;

          await databases.createDocument(dbId, notificationsCol, ID.unique(), {
            user_id: userId,
            media_id: sequel.id,
            episode: 0,
            title: sequel.title,
            cover_url: sequel.coverUrl,
            airing_at: 0,
            is_read: false,
            type: 'sequel',
            created_at: new Date().toISOString(),
          });

          created++;
        }

        await delay(1000);
      }
    }

    const done = res.documents.length < batchSize;

    return NextResponse.json({
      processed: res.documents.length,
      created,
      offset,
      done,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sequel scan failed' },
      { status: 500 },
    );
  }
}
