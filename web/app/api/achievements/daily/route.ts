import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { fireAchievementEvent } from '@/lib/achievements/engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Reset streaks for users who missed yesterday
    const { data: staleStreaks } = await supabase
      .from('user_streaks')
      .select('id, user_id')
      .lt('last_active_date', yesterday)
      .gt('current_streak', 0);

    let streaksReset = 0;
    for (const streak of (staleStreaks || [])) {
      await supabase
        .from('user_streaks')
        .update({ current_streak: 0, updated_at: new Date().toISOString() })
        .eq('id', streak.id);
      streaksReset++;
    }

    // Check time-based achievements for all active users
    const { data: activeUsers } = await supabase
      .from('user_streaks')
      .select('user_id')
      .gte('last_active_date', yesterday)
      .limit(1000);

    let timeChecked = 0;
    for (const user of (activeUsers || [])) {
      const userId = user.user_id as string;
      await fireAchievementEvent(userId, 'login', supabase);
      timeChecked++;
    }

    return NextResponse.json({
      streaksReset,
      timeChecked,
      date: today,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Daily check failed' },
      { status: 500 },
    );
  }
}
