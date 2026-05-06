import { supabase } from '@/lib/supabase';
import type { AiringSchedule } from '@/lib/types';

const STALE_MS = 6 * 60 * 60 * 1000;

function getWeekKey(fromTimestamp: number): string {
  const d = new Date(fromTimestamp * 1000);
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export async function getCachedAiring(
  fromTimestamp: number,
): Promise<{ schedules: AiringSchedule[]; stale: boolean } | null> {
  try {
    const weekKey = getWeekKey(fromTimestamp);
    const { data } = await supabase
      .from('airing_cache')
      .select()
      .eq('week_key', weekKey)
      .limit(1);

    if (!data || data.length === 0) return null;

    const doc = data[0];
    const schedules: AiringSchedule[] = JSON.parse(doc.schedule_json as string);
    const updatedAt = new Date(doc.updated_at as string).getTime();
    const stale = Date.now() - updatedAt > STALE_MS;

    return { schedules, stale };
  } catch (err) {
    console.error('[AiringCache] Read failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function saveAiringToCache(
  fromTimestamp: number,
  schedules: AiringSchedule[],
): Promise<void> {
  try {
    const weekKey = getWeekKey(fromTimestamp);
    const data = {
      week_key: weekKey,
      schedule_json: JSON.stringify(schedules),
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('airing_cache')
      .select('id')
      .eq('week_key', weekKey)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase.from('airing_cache').update(data).eq('id', existing[0].id);
    } else {
      await supabase.from('airing_cache').insert(data);
    }
  } catch (err) {
    console.error('[AiringCache] Write failed:', err instanceof Error ? err.message : err);
  }
}
