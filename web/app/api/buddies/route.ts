import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query, ID } from 'node-appwrite';

export const dynamic = 'force-dynamic';

function getDb() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return {
    databases: new Databases(client),
    dbId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    buddiesCol: process.env.NEXT_PUBLIC_APPWRITE_BUDDIES_COLLECTION_ID!,
    profilesCol: process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID!,
    notificationsCol: process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID!,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { senderId, receiverUsername } = await req.json();
    if (!senderId || !receiverUsername) {
      return NextResponse.json({ error: 'Missing senderId or receiverUsername' }, { status: 400 });
    }

    const { databases, dbId, buddiesCol, profilesCol, notificationsCol } = getDb();

    const receiverProfile = await databases.listDocuments(dbId, profilesCol, [
      Query.equal('username', receiverUsername),
      Query.limit(1),
    ]);
    if (receiverProfile.total === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const receiverId = receiverProfile.documents[0].user_id as string;

    if (senderId === receiverId) {
      return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 });
    }

    const existing = await databases.listDocuments(dbId, buddiesCol, [
      Query.or([
        Query.and([Query.equal('sender_id', senderId), Query.equal('receiver_id', receiverId)]),
        Query.and([Query.equal('sender_id', receiverId), Query.equal('receiver_id', senderId)]),
      ]),
      Query.limit(1),
    ]);
    if (existing.total > 0) {
      const status = existing.documents[0].status;
      return NextResponse.json({ error: `Request already exists (${status})` }, { status: 409 });
    }

    const doc = await databases.createDocument(dbId, buddiesCol, ID.unique(), {
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    const senderProfile = await databases.listDocuments(dbId, profilesCol, [
      Query.equal('user_id', senderId),
      Query.limit(1),
    ]);
    const senderName = senderProfile.total > 0
      ? (senderProfile.documents[0].display_name as string) || (senderProfile.documents[0].username as string)
      : 'Someone';

    await databases.createDocument(dbId, notificationsCol, ID.unique(), {
      user_id: receiverId,
      media_id: 0,
      episode: 0,
      title: senderName,
      cover_url: '',
      airing_at: 0,
      is_read: false,
      type: 'buddy_request',
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, buddyId: doc.$id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send buddy request' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { databases, dbId, buddiesCol, profilesCol } = getDb();

    const asSender = await databases.listDocuments(dbId, buddiesCol, [
      Query.equal('sender_id', userId),
      Query.limit(100),
    ]);
    const asReceiver = await databases.listDocuments(dbId, buddiesCol, [
      Query.equal('receiver_id', userId),
      Query.limit(100),
    ]);

    const allDocs = [...asSender.documents, ...asReceiver.documents];

    const buddyUserIds = new Set<string>();
    const pendingReceived: typeof allDocs = [];
    const pendingSent: typeof allDocs = [];
    const accepted: typeof allDocs = [];

    for (const doc of allDocs) {
      if (doc.status === 'accepted') {
        accepted.push(doc);
        const otherId = (doc.sender_id as string) === userId ? (doc.receiver_id as string) : (doc.sender_id as string);
        buddyUserIds.add(otherId);
      } else if (doc.status === 'pending') {
        if ((doc.receiver_id as string) === userId) pendingReceived.push(doc);
        else pendingSent.push(doc);
        const otherId = (doc.sender_id as string) === userId ? (doc.receiver_id as string) : (doc.sender_id as string);
        buddyUserIds.add(otherId);
      }
    }

    const profileMap = new Map<string, { username: string; displayName: string | null }>();
    if (buddyUserIds.size > 0) {
      const ids = [...buddyUserIds];
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const profiles = await databases.listDocuments(dbId, profilesCol, [
          Query.equal('user_id', batch),
          Query.limit(100),
        ]);
        for (const p of profiles.documents) {
          profileMap.set(p.user_id as string, {
            username: p.username as string,
            displayName: (p.display_name as string) || null,
          });
        }
      }
    }

    function enrichDoc(doc: (typeof allDocs)[0]) {
      const otherId = (doc.sender_id as string) === userId ? (doc.receiver_id as string) : (doc.sender_id as string);
      const profile = profileMap.get(otherId);
      return {
        $id: doc.$id,
        userId: otherId,
        username: profile?.username || 'unknown',
        displayName: profile?.displayName || null,
        status: doc.status,
        isSender: (doc.sender_id as string) === userId,
      };
    }

    return NextResponse.json({
      buddies: accepted.map(enrichDoc),
      pendingReceived: pendingReceived.map(enrichDoc),
      pendingSent: pendingSent.map(enrichDoc),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list buddies' },
      { status: 500 },
    );
  }
}
