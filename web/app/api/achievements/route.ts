import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import type { AchievementWithProgress } from '@/lib/achievements/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data: achievements } = await supabase
      .from('achievements')
      .select()
      .order('sort_order');

    const { data: userProgress } = await supabase
      .from('user_achievements')
      .select()
      .eq('user_id', userId);

    const progressMap = new Map(
      (userProgress || []).map((p) => [p.achievement_id as string, p])
    );

    const catalog: AchievementWithProgress[] = (achievements || []).map((a) => {
      const p = progressMap.get(a.id as string);
      return {
        ...a,
        progress: (p?.progress as number) || 0,
        target: (p?.target as number) || (a.criteria_config as Record<string, unknown>).threshold as number || 1,
        unlocked: !!(p?.unlocked),
        unlocked_at: (p?.unlocked_at as string) || null,
      } as AchievementWithProgress;
    }).filter((a) => !a.hidden || a.unlocked);

    return NextResponse.json({ achievements: catalog });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load achievements' },
      { status: 500 },
    );
  }
}
