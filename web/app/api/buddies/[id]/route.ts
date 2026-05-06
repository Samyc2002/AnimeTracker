import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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

    const supabase = getServiceSupabase();

    const { data: doc, error: getError } = await supabase
      .from('buddies')
      .select()
      .eq('id', id)
      .single();

    if (getError || !doc) {
      return NextResponse.json({ error: 'Buddy request not found' }, { status: 404 });
    }

    if ((doc.receiver_id as string) !== userId) {
      return NextResponse.json({ error: 'Only the receiver can respond' }, { status: 403 });
    }

    if (doc.status !== 'pending') {
      return NextResponse.json({ error: 'Request already resolved' }, { status: 400 });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    await supabase.from('buddies').update({ status: newStatus }).eq('id', id);

    if (newStatus === 'accepted') {
      const { data: receiverDocs } = await supabase
        .from('profiles')
        .select()
        .eq('user_id', userId)
        .limit(1);

      const receiverName = receiverDocs && receiverDocs.length > 0
        ? (receiverDocs[0].display_name as string) || (receiverDocs[0].username as string)
        : 'Someone';

      await supabase
        .from('notifications')
        .insert({
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

    const supabase = getServiceSupabase();

    const { data: doc, error: getError } = await supabase
      .from('buddies')
      .select()
      .eq('id', id)
      .single();

    if (getError || !doc) {
      return NextResponse.json({ error: 'Buddy request not found' }, { status: 404 });
    }

    if ((doc.sender_id as string) !== userId && (doc.receiver_id as string) !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await supabase.from('buddies').delete().eq('id', id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to remove buddy' },
      { status: 500 },
    );
  }
}
