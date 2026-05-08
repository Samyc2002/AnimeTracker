import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MAX_PINNED = 3;

export async function POST(req: NextRequest) {
  try {
    const { userId, badgeId } = await req.json();
    if (!userId || !badgeId) {
      return NextResponse.json({ error: 'Missing userId or badgeId' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data: badge } = await supabase
      .from('user_achievements')
      .select('id, unlocked, is_pinned')
      .eq('user_id', userId)
      .eq('achievement_id', badgeId)
      .eq('unlocked', true)
      .limit(1);

    if (!badge || badge.length === 0) {
      return NextResponse.json({ error: 'Badge not earned' }, { status: 400 });
    }

    if (badge[0].is_pinned) {
      return NextResponse.json({ error: 'Already pinned' }, { status: 400 });
    }

    const { count: pinnedCount } = await supabase
      .from('user_achievements')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_pinned', true);

    if ((pinnedCount || 0) >= MAX_PINNED) {
      return NextResponse.json({ error: `Maximum ${MAX_PINNED} badges can be pinned` }, { status: 400 });
    }

    await supabase
      .from('user_achievements')
      .update({ is_pinned: true, pinned_at: new Date().toISOString() })
      .eq('id', badge[0].id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to pin badge' },
      { status: 500 },
    );
  }
}
