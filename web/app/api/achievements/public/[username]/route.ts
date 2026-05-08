import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const supabase = getServiceSupabase();

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', username)
      .eq('is_public', true)
      .limit(1);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ badges: [] });
    }

    const userId = profiles[0].user_id as string;

    const { data: badgeRows } = await supabase
      .from('user_achievements')
      .select('achievement_id, is_pinned, pinned_at, unlocked_at')
      .eq('user_id', userId)
      .eq('unlocked', true)
      .order('is_pinned', { ascending: false })
      .order('unlocked_at', { ascending: false });

    if (!badgeRows || badgeRows.length === 0) {
      return NextResponse.json({ badges: [] });
    }

    const { data: achievements } = await supabase
      .from('achievements')
      .select('id, name, description, asset_name, type')
      .eq('type', 'badge');

    const achievementMap = new Map(
      (achievements || []).map((a) => [a.id as string, a])
    );

    const badges = badgeRows
      .filter((b) => achievementMap.has(b.achievement_id as string))
      .map((b) => ({
        ...achievementMap.get(b.achievement_id as string),
        is_pinned: b.is_pinned,
        unlocked_at: b.unlocked_at,
      }))
      .slice(0, 3);

    return NextResponse.json({ badges });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load badges' },
      { status: 500 },
    );
  }
}
