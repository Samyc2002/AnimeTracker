import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query, ID } from 'node-appwrite';
import { fetchUserList, mediaToWatchlistEntry, ANILIST_STATUS_MAP } from '@/lib/anime-provider';

export const dynamic = 'force-dynamic';

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
    const profilesCol = process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID!;
    const watchlistCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;
    const watchedEpCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHED_EPISODES_COLLECTION_ID!;

    const profileRes = await databases.listDocuments(dbId, profilesCol, [
      Query.equal('user_id', userId),
      Query.limit(1),
    ]);

    if (profileRes.documents.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profileRes.documents[0];
    const anilistUserId = profile.anilist_user_id as number | null;
    const anilistToken = profile.anilist_token as string | null;

    if (!anilistUserId || !anilistToken) {
      return NextResponse.json({ error: 'AniList not connected' }, { status: 400 });
    }

    const anilistEntries = await fetchUserList(anilistUserId, anilistToken);

    const existing = await databases.listDocuments(dbId, watchlistCol, [
      Query.equal('user_id', userId),
      Query.select(['media_id', '$id']),
      Query.limit(500),
    ]);
    const existingMap = new Map(
      existing.documents.map((d) => [d.media_id as number, d.$id])
    );

    let created = 0;
    let updated = 0;

    for (const entry of anilistEntries) {
      const docData = {
        ...mediaToWatchlistEntry(entry.media),
        user_id: userId,
        watch_status: entry.watchStatus,
      };

      const existingDocId = existingMap.get(entry.media.id);

      if (existingDocId) {
        await databases.updateDocument(dbId, watchlistCol, existingDocId, docData);
        updated++;
      } else {
        await databases.createDocument(dbId, watchlistCol, ID.unique(), docData);
        created++;
      }

      if (entry.progress > 0) {
        const watchedRes = await databases.listDocuments(dbId, watchedEpCol, [
          Query.equal('user_id', userId),
          Query.equal('media_id', entry.media.id),
          Query.limit(5000),
        ]);
        const watchedEps = new Set(
          watchedRes.documents.map((d) => d.episode_number as number)
        );

        for (let ep = 1; ep <= entry.progress; ep++) {
          if (!watchedEps.has(ep)) {
            await databases.createDocument(dbId, watchedEpCol, ID.unique(), {
              user_id: userId,
              media_id: entry.media.id,
              episode_number: ep,
            });
          }
        }
      }
    }

    return NextResponse.json({ created, updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    );
  }
}
