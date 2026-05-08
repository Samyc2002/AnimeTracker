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
