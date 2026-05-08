import { NextResponse } from 'next/server';
import { recordHeartbeat, getOnlineCount } from '@/lib/online-tracker';
import { getServiceSupabase } from '@/lib/supabase';
import { fireAchievementEvent } from '@/lib/achievements/engine';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    recordHeartbeat(userId);

    // Streak tracking & login achievement
    const serviceSupabase = getServiceSupabase();
    const today = new Date().toISOString().slice(0, 10);

    const { data: streakRows } = await serviceSupabase
      .from('user_streaks')
      .select()
      .eq('user_id', userId)
      .limit(1);

    if (streakRows && streakRows.length > 0) {
      const row = streakRows[0];
      const lastDate = row.last_active_date as string | null;

      if (lastDate !== today) {
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        const newStreak = lastDate === yesterday ? (row.current_streak as number) + 1 : 1;
        const longest = Math.max(newStreak, row.longest_streak as number);

        await serviceSupabase
          .from('user_streaks')
          .update({
            current_streak: newStreak,
            longest_streak: longest,
            last_active_date: today,
          })
          .eq('user_id', userId);
      }
    } else {
      await serviceSupabase
        .from('user_streaks')
        .insert({
          user_id: userId,
          current_streak: 1,
          longest_streak: 1,
          last_active_date: today,
        });
    }

    fireAchievementEvent(userId, 'login', serviceSupabase).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ online_now: getOnlineCount() });
}
