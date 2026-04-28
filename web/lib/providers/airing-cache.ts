import { Query, ID } from 'appwrite';
import { databases, DATABASE_ID, AIRING_CACHE_COLLECTION_ID } from '@/lib/appwrite';
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
    const res = await databases.listDocuments(DATABASE_ID, AIRING_CACHE_COLLECTION_ID, [
      Query.equal('week_key', weekKey),
      Query.limit(1),
    ]);

    if (res.documents.length === 0) return null;

    const doc = res.documents[0];
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

    const existing = await databases.listDocuments(DATABASE_ID, AIRING_CACHE_COLLECTION_ID, [
      Query.equal('week_key', weekKey),
      Query.limit(1),
    ]);

    if (existing.documents.length > 0) {
      await databases.updateDocument(DATABASE_ID, AIRING_CACHE_COLLECTION_ID, existing.documents[0].$id, data);
    } else {
      await databases.createDocument(DATABASE_ID, AIRING_CACHE_COLLECTION_ID, ID.unique(), data);
    }
  } catch (err) {
    console.error('[AiringCache] Write failed:', err instanceof Error ? err.message : err);
  }
}
