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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { action, userId } = await req.json();
    if (!action || !userId) {
      return NextResponse.json({ error: 'Missing action or userId' }, { status: 400 });
    }

    const { databases, dbId, buddiesCol, profilesCol, notificationsCol } = getDb();

    const doc = await databases.getDocument(dbId, buddiesCol, id);
    if ((doc.receiver_id as string) !== userId) {
      return NextResponse.json({ error: 'Only the receiver can respond' }, { status: 403 });
    }

    if (doc.status !== 'pending') {
      return NextResponse.json({ error: 'Request already resolved' }, { status: 400 });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    await databases.updateDocument(dbId, buddiesCol, id, { status: newStatus });

    if (newStatus === 'accepted') {
      const receiverProfile = await databases.listDocuments(dbId, profilesCol, [
        Query.equal('user_id', userId),
        Query.limit(1),
      ]);
      const receiverName = receiverProfile.total > 0
        ? (receiverProfile.documents[0].display_name as string) || (receiverProfile.documents[0].username as string)
        : 'Someone';

      await databases.createDocument(dbId, notificationsCol, ID.unique(), {
        user_id: doc.sender_id as string,
        media_id: 0,
        episode: 0,
        title: receiverName,
        cover_url: '',
        airing_at: 0,
        is_read: false,
        type: 'buddy_accept',
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update buddy request' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { databases, dbId, buddiesCol } = getDb();

    const doc = await databases.getDocument(dbId, buddiesCol, id);
    if ((doc.sender_id as string) !== userId && (doc.receiver_id as string) !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await databases.deleteDocument(dbId, buddiesCol, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to remove buddy' },
      { status: 500 },
    );
  }
}
