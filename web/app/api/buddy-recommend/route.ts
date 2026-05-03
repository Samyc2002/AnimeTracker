import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query, ID } from 'node-appwrite';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { fromUserId, toUserId, mediaId, title, coverUrl, message } = await req.json();
    if (!fromUserId || !toUserId || !mediaId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const buddiesCol = process.env.NEXT_PUBLIC_APPWRITE_BUDDIES_COLLECTION_ID!;
    const buddyRecsCol = process.env.NEXT_PUBLIC_APPWRITE_BUDDY_RECS_COLLECTION_ID!;
    const notificationsCol = process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID!;
    const profilesCol = process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID!;

    const buddyCheck = await databases.listDocuments(dbId, buddiesCol, [
      Query.or([
        Query.and([Query.equal('sender_id', fromUserId), Query.equal('receiver_id', toUserId)]),
        Query.and([Query.equal('sender_id', toUserId), Query.equal('receiver_id', fromUserId)]),
      ]),
      Query.equal('status', 'accepted'),
      Query.limit(1),
    ]);
    if (buddyCheck.total === 0) {
      return NextResponse.json({ error: 'You are not buddies with this user' }, { status: 403 });
    }

    const dupCheck = await databases.listDocuments(dbId, buddyRecsCol, [
      Query.equal('from_user_id', fromUserId),
      Query.equal('to_user_id', toUserId),
      Query.equal('media_id', mediaId),
      Query.limit(1),
    ]);
    if (dupCheck.total > 0) {
      return NextResponse.json({ error: 'Already recommended this anime' }, { status: 409 });
    }

    await databases.createDocument(dbId, buddyRecsCol, ID.unique(), {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      media_id: mediaId,
      title,
      cover_url: coverUrl || '',
      message: message || null,
      created_at: new Date().toISOString(),
    });

    const senderProfile = await databases.listDocuments(dbId, profilesCol, [
      Query.equal('user_id', fromUserId),
      Query.limit(1),
    ]);
    const senderName = senderProfile.total > 0
      ? (senderProfile.documents[0].display_name as string) || (senderProfile.documents[0].username as string)
      : 'A buddy';

    await databases.createDocument(dbId, notificationsCol, ID.unique(), {
      user_id: toUserId,
      media_id: mediaId,
      episode: 0,
      title: `${senderName} recommended ${title}`,
      cover_url: coverUrl || '',
      airing_at: 0,
      is_read: false,
      type: 'buddy_rec',
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send recommendation' },
      { status: 500 },
    );
  }
}
