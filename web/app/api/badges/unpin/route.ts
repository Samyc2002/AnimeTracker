import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId, badgeId } = await req.json();
    if (!userId || !badgeId) {
      return NextResponse.json({ error: 'Missing userId or badgeId' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    await supabase
      .from('user_achievements')
      .update({ is_pinned: false, pinned_at: null })
      .eq('user_id', userId)
      .eq('achievement_id', badgeId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to unpin badge' },
      { status: 500 },
    );
  }
}
