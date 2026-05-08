import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data: badges } = await supabase
      .from('user_badges')
      .select('achievement_id, pin_order')
      .eq('user_id', userId)
      .order('pin_order');

    if (!badges || badges.length === 0) {
      return NextResponse.json({ badges: [] });
    }

    const achievementIds = badges.map((b) => b.achievement_id as string);
    const { data: achievements } = await supabase
      .from('achievements')
      .select('id, name, description, asset_name')
      .in('id', achievementIds);

    const achievementMap = new Map(
      (achievements || []).map((a) => [a.id as string, a])
    );

    const result = badges.map((b) => ({
      ...achievementMap.get(b.achievement_id as string),
      pin_order: b.pin_order,
    }));

    return NextResponse.json({ badges: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load badges' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, achievementId, pinOrder, action } = await req.json();
    if (!userId || !achievementId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    if (action === 'unpin') {
      await supabase
        .from('user_badges')
        .delete()
        .eq('user_id', userId)
        .eq('achievement_id', achievementId);
      return NextResponse.json({ success: true });
    }

    const { data: unlocked } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_id', achievementId)
      .eq('unlocked', true)
      .limit(1);

    if (!unlocked || unlocked.length === 0) {
      return NextResponse.json({ error: 'Achievement not unlocked' }, { status: 400 });
    }

    const { count: badgeCount } = await supabase
      .from('user_badges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((badgeCount || 0) >= 5) {
      return NextResponse.json({ error: 'Maximum 5 badges allowed' }, { status: 400 });
    }

    const order = pinOrder || ((badgeCount || 0) + 1);

    const { error } = await supabase
      .from('user_badges')
      .upsert({
        user_id: userId,
        achievement_id: achievementId,
        pin_order: order,
      }, { onConflict: 'user_id,achievement_id' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update badge' },
      { status: 500 },
    );
  }
}
