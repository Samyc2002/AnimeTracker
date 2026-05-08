import type { AchievementEventType } from './types';

export function fireClientAchievementEvent(userId: string, eventType: AchievementEventType): void {
  fetch('/api/achievements/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, eventType }),
  }).catch(() => {});
}
