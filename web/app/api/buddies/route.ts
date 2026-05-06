import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { senderId, receiverUsername } = await req.json();
    if (!senderId || !receiverUsername) {
      return NextResponse.json({ error: 'Missing senderId or receiverUsername' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data: receiverDocs } = await supabase
      .from('profiles')
      .select()
      .eq('username', receiverUsername)
      .limit(1);

    if (!receiverDocs || receiverDocs.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const receiverId = receiverDocs[0].user_id as string;

    if (senderId === receiverId) {
      return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 });
    }

    const { data: existingDocs } = await supabase
      .from('buddies')
      .select()
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .limit(1);

    if (existingDocs && existingDocs.length > 0) {
      const status = existingDocs[0].status;
      return NextResponse.json({ error: `Request already exists (${status})` }, { status: 409 });
    }

    const { data: doc, error: insertError } = await supabase
      .from('buddies')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const { data: senderDocs } = await supabase
      .from('profiles')
      .select()
      .eq('user_id', senderId)
      .limit(1);

    const senderName = senderDocs && senderDocs.length > 0
      ? (senderDocs[0].display_name as string) || (senderDocs[0].username as string)
      : 'Someone';

    await supabase
      .from('notifications')
      .insert({
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

    return NextResponse.json({ success: true, buddyId: doc.id });
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

    const supabase = getServiceSupabase();

    const [asSenderResult, asReceiverResult] = await Promise.all([
      supabase.from('buddies').select().eq('sender_id', userId).limit(100),
      supabase.from('buddies').select().eq('receiver_id', userId).limit(100),
    ]);

    const allDocs = [...(asSenderResult.data || []), ...(asReceiverResult.data || [])];

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
        const { data: profilesDocs } = await supabase
          .from('profiles')
          .select()
          .in('user_id', batch)
          .limit(100);

        for (const p of (profilesDocs || [])) {
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
        $id: doc.id,
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
