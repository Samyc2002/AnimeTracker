import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { fireAchievementEvent } from '@/lib/achievements/engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { fromUserId, toUserId, mediaId, title, coverUrl, message } = await req.json();
    if (!fromUserId || !toUserId || !mediaId || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data: buddyDocs } = await supabase
      .from('buddies')
      .select()
      .or(`and(sender_id.eq.${fromUserId},receiver_id.eq.${toUserId}),and(sender_id.eq.${toUserId},receiver_id.eq.${fromUserId})`)
      .eq('status', 'accepted')
      .limit(1);

    if (!buddyDocs || buddyDocs.length === 0) {
      return NextResponse.json({ error: 'You are not buddies with this user' }, { status: 403 });
    }

    const { data: dupDocs } = await supabase
      .from('buddy_recommendations')
      .select()
      .eq('from_user_id', fromUserId)
      .eq('to_user_id', toUserId)
      .eq('media_id', mediaId)
      .limit(1);

    if (dupDocs && dupDocs.length > 0) {
      return NextResponse.json({ error: 'Already recommended this anime' }, { status: 409 });
    }

    await supabase
      .from('buddy_recommendations')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        media_id: mediaId,
        title,
        cover_url: coverUrl || '',
        message: message || null,
        created_at: new Date().toISOString(),
      });

    const { data: senderDocs } = await supabase
      .from('profiles')
      .select()
      .eq('user_id', fromUserId)
      .limit(1);

    const senderName = senderDocs && senderDocs.length > 0
      ? (senderDocs[0].display_name as string) || (senderDocs[0].username as string)
      : 'A buddy';

    await supabase
      .from('notifications')
      .insert({
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

    fireAchievementEvent(fromUserId, 'buddy_recommend', supabase).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send recommendation' },
      { status: 500 },
    );
  }
}
