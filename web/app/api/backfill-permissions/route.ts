import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query, Permission, Role } from 'node-appwrite';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  const databases = new Databases(client);
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

  const collections = [
    { id: process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID!, userField: 'user_id' },
    { id: process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!, userField: 'user_id' },
    { id: process.env.NEXT_PUBLIC_APPWRITE_WATCHED_EPISODES_COLLECTION_ID!, userField: 'user_id' },
    { id: process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID!, userField: 'user_id' },
  ];

  const results: Record<string, number> = {};

  for (const col of collections) {
    let updated = 0;
    let offset = 0;

    while (true) {
      const res = await databases.listDocuments(dbId, col.id, [
        Query.limit(100),
        Query.offset(offset),
        Query.select([col.userField]),
      ]);

      for (const doc of res.documents) {
        const userId = doc[col.userField] as string;
        if (!userId) continue;

        await databases.updateDocument(dbId, col.id, doc.$id, {}, [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ]);
        updated++;
      }

      if (res.documents.length < 100) break;
      offset += 100;
    }

    results[col.id] = updated;
  }

  return NextResponse.json({ updated: results });
}
