import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { fireAchievementEvent } from '@/lib/achievements/engine';
import type { AchievementEventType } from '@/lib/achievements/types';

export const dynamic = 'force-dynamic';

const VALID_EVENT_TYPES: AchievementEventType[] = [
  'watchlist_add',
  'status_change',
  'playlist_create',
  'buddy_accept',
  'buddy_recommend',
  'import_complete',
  'login',
  'profile_update',
  'sequel_alert',
  'episode_watched',
];

export async function POST(req: NextRequest) {
  try {
    const { userId, eventType } = await req.json();

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (!eventType || !VALID_EVENT_TYPES.includes(eventType as AchievementEventType)) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
    }

    const serviceSupabase = getServiceSupabase();
    const unlocked = await fireAchievementEvent(userId, eventType as AchievementEventType, serviceSupabase);

    return NextResponse.json({ unlocked });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process achievement event' },
      { status: 500 },
    );
  }
}
