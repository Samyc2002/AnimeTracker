import type { SupabaseClient } from '@supabase/supabase-js';
import { getEvaluator } from './evaluators';
import type { Achievement, AchievementEventType } from './types';

export async function fireAchievementEvent(
  userId: string,
  eventType: AchievementEventType,
  supabase: SupabaseClient,
): Promise<string[]> {
  const unlocked: string[] = [];

  try {
    const { data: achievements } = await supabase
      .from('achievements')
      .select()
      .contains('event_types', [eventType]);

    if (!achievements || achievements.length === 0) return unlocked;

    for (const achievement of achievements as Achievement[]) {
      const evaluator = getEvaluator(achievement.criteria_type);
      if (!evaluator) continue;

      try {
        const { progress, target } = await evaluator(userId, achievement.criteria_config, supabase);
        const isUnlocked = progress >= target;

        const { data: existing } = await supabase
          .from('user_achievements')
          .select('id, unlocked, progress')
          .eq('user_id', userId)
          .eq('achievement_id', achievement.id)
          .limit(1);

        if (existing && existing.length > 0) {
          const row = existing[0];
          if (row.unlocked) continue;

          await supabase
            .from('user_achievements')
            .update({
              progress,
              unlocked: isUnlocked,
              unlocked_at: isUnlocked ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
        } else {
          await supabase
            .from('user_achievements')
            .insert({
              user_id: userId,
              achievement_id: achievement.id,
              progress,
              target,
              unlocked: isUnlocked,
              unlocked_at: isUnlocked ? new Date().toISOString() : null,
            });
        }

        if (isUnlocked && (!existing || existing.length === 0 || !existing[0].unlocked)) {
          unlocked.push(achievement.id);

          await supabase.from('notifications').insert({
            user_id: userId,
            media_id: 0,
            episode: 0,
            title: `Achievement unlocked: ${achievement.name}`,
            cover_url: '',
            airing_at: 0,
            is_read: false,
            type: 'achievement',
            created_at: new Date().toISOString(),
          });
        }
      } catch {
        // Individual achievement evaluation failure shouldn't block others
      }
    }
  } catch {
    // Achievement system failure is non-critical
  }

  return unlocked;
}
