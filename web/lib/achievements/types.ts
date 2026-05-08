export interface Achievement {
  id: string;
  name: string;
  description: string;
  asset_name: string;
  category: string;
  criteria_type: string;
  criteria_config: Record<string, unknown>;
  event_types: string[];
  sort_order: number;
  hidden: boolean;
  tier: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  progress: number;
  target: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface UserBadge {
  id: string;
  user_id: string;
  achievement_id: string;
  pin_order: number;
}

export interface AchievementWithProgress extends Achievement {
  progress: number;
  target: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

export type AchievementEventType =
  | 'watchlist_add'
  | 'status_change'
  | 'playlist_create'
  | 'buddy_accept'
  | 'buddy_recommend'
  | 'import_complete'
  | 'login'
  | 'profile_update'
  | 'sequel_alert'
  | 'episode_watched';
