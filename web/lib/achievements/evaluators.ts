import type { SupabaseClient } from '@supabase/supabase-js';

type EvalResult = { progress: number; target: number };
type Evaluator = (userId: string, config: Record<string, unknown>, supabase: SupabaseClient) => Promise<EvalResult>;

const evaluators: Record<string, Evaluator> = {
  founding_member_check: async (userId, config, supabase) => {
    const maxMembers = (config.max_members as number) || 100;
    const minWatchlist = (config.min_watchlist as number) || 3;
    const testAccounts = (process.env.TEST_ACCOUNTS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

    try {
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('unlocked')
        .eq('user_id', userId)
        .eq('achievement_id', 'founding_member')
        .limit(1);
      if (existing && existing.length > 0 && existing[0].unlocked) {
        return { progress: 1, target: 1 };
      }

      const { data: counterRow } = await supabase
        .from('founding_member_config')
        .select('count, max_members')
        .eq('id', 'counter')
        .single();
      if (!counterRow || (counterRow.count as number) >= maxMembers) {
        return { progress: 0, target: 1 };
      }

      const { count: wlCount } = await supabase
        .from('watchlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if ((wlCount || 0) < minWatchlist) {
        return { progress: 0, target: 1 };
      }

      // Check if this is a test account — award badge but don't count toward the 100 limit
      let isTestAccount = false;
      if (testAccounts.length > 0) {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        if (userData?.user?.email && testAccounts.includes(userData.user.email.toLowerCase())) {
          isTestAccount = true;
        }
      }

      if (!isTestAccount) {
        await supabase
          .from('founding_member_config')
          .update({ count: (counterRow.count as number) + 1 })
          .eq('id', 'counter');
      }

      return { progress: 1, target: 1 };
    } catch {
      return { progress: 0, target: 1 };
    }
  },

  account_created_before: async (userId, config, supabase) => {
    const cutoff = config.date as string;
    try {
      const { data } = await supabase.auth.admin.getUserById(userId);
      if (!data?.user?.created_at) return { progress: 0, target: 1 };
      const created = new Date(data.user.created_at);
      return { progress: created < new Date(cutoff) ? 1 : 0, target: 1 };
    } catch {
      return { progress: 0, target: 1 };
    }
  },

  action_count: async (userId, config, supabase) => {
    const action = config.action as string;
    const threshold = (config.threshold as number) || 1;

    const countMap: Record<string, { table: string; filters?: Record<string, unknown> }> = {
      watchlist_add: { table: 'watchlist_entries' },
      playlist_create: { table: 'playlists' },
      buddy_add: { table: 'buddies', filters: { status: 'accepted' } },
      recommendation_send: { table: 'buddy_recommendations' },
      sequel_alert_received: { table: 'notifications', filters: { type: 'sequel' } },
      anime_note_add: { table: 'watched_episodes' },
    };

    const mapping = countMap[action];
    if (!mapping) return { progress: 0, target: threshold };

    let query = supabase.from(mapping.table).select('*', { count: 'exact', head: true });

    if (mapping.table === 'buddies') {
      query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    } else if (mapping.table === 'buddy_recommendations') {
      query = query.eq('from_user_id', userId);
    } else {
      query = query.eq('user_id', userId);
    }

    if (mapping.filters) {
      for (const [key, val] of Object.entries(mapping.filters)) {
        query = query.eq(key, val);
      }
    }

    const { count } = await query;
    return { progress: Math.min(count || 0, threshold), target: threshold };
  },

  action_any: async (userId, config, supabase) => {
    const actions = config.actions as string[];
    for (const action of actions) {
      const result = await evaluators.action_count(userId, { action, threshold: 1 }, supabase);
      if (result.progress >= 1) return { progress: 1, target: 1 };
    }

    const importActions = ['kitsu_import_complete', 'anilist_import_complete', 'mal_import_complete'];
    if (actions.some((a) => importActions.includes(a))) {
      const { data } = await supabase
        .from('profiles')
        .select('anilist_user_id, kitsu_username')
        .eq('user_id', userId)
        .limit(1);
      if (data && data.length > 0) {
        if (data[0].anilist_user_id || data[0].kitsu_username) {
          return { progress: 1, target: 1 };
        }
      }
    }

    return { progress: 0, target: 1 };
  },

  completed_count: async (userId, config, supabase) => {
    const threshold = (config.threshold as number) || 1;
    const { count } = await supabase
      .from('watchlist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('watch_status', 'Completed');
    return { progress: Math.min(count || 0, threshold), target: threshold };
  },

  status_count: async (userId, config, supabase) => {
    const status = config.status as string;
    const threshold = (config.threshold as number) || 1;
    const { count } = await supabase
      .from('watchlist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('watch_status', status);
    return { progress: Math.min(count || 0, threshold), target: threshold };
  },

  distinct_count: async (userId, config, supabase) => {
    const source = config.source as string;
    const threshold = (config.threshold as number) || 1;

    try {
      // Step 1: get completed entries with canonical_anilist_id (skip unresolved)
      const { data: entries } = await supabase
        .from('watchlist_entries')
        .select('canonical_anilist_id')
        .eq('user_id', userId)
        .eq('watch_status', 'Completed')
        .not('canonical_anilist_id', 'is', null)
        .limit(5000);

      const total = entries?.length ?? 0;
      if (total === 0) return { progress: 0, target: threshold };

      const skippedNoCanonical = 0; // already filtered above via .not('canonical_anilist_id', 'is', null)
      const canonicalIds = (entries || []).map((e) => e.canonical_anilist_id as number);

      if (source === 'completed_anime_genres') {
        const { data: meta } = await supabase
          .from('series_metadata')
          .select('genres')
          .in('anilist_id', canonicalIds)
          .not('genres', 'is', null);

        const skippedNoMetadata = canonicalIds.length - (meta?.length ?? 0);
        console.log(`evaluator: completed_anime_genres, total: ${total}, skipped_no_canonical: ${skippedNoCanonical}, skipped_no_metadata: ${skippedNoMetadata}, evaluated: ${meta?.length ?? 0}`);

        const genres = new Set<string>();
        for (const row of (meta || [])) {
          if (Array.isArray(row.genres)) {
            (row.genres as string[]).filter(Boolean).forEach((g) => genres.add(g));
          }
        }
        return { progress: Math.min(genres.size, threshold), target: threshold };
      }

      if (source === 'completed_anime_studios') {
        const { data: meta } = await supabase
          .from('series_metadata')
          .select('studio')
          .in('anilist_id', canonicalIds)
          .not('studio', 'is', null);

        const skippedNoMetadata = canonicalIds.length - (meta?.length ?? 0);
        console.log(`evaluator: completed_anime_studios, total: ${total}, skipped_no_canonical: ${skippedNoCanonical}, skipped_no_metadata: ${skippedNoMetadata}, evaluated: ${meta?.length ?? 0}`);

        const studios = new Set<string>();
        for (const row of (meta || [])) {
          if (row.studio) studios.add(row.studio as string);
        }
        return { progress: Math.min(studios.size, threshold), target: threshold };
      }

      if (source === 'completed_anime_decades') {
        const { data: meta } = await supabase
          .from('series_metadata')
          .select('season_year')
          .in('anilist_id', canonicalIds)
          .not('season_year', 'is', null);

        const skippedNoMetadata = canonicalIds.length - (meta?.length ?? 0);
        console.log(`evaluator: completed_anime_decades, total: ${total}, skipped_no_canonical: ${skippedNoCanonical}, skipped_no_metadata: ${skippedNoMetadata}, evaluated: ${meta?.length ?? 0}`);

        const decades = new Set<number>();
        for (const row of (meta || [])) {
          if (row.season_year) decades.add(Math.floor((row.season_year as number) / 10) * 10);
        }
        return { progress: Math.min(decades.size, threshold), target: threshold };
      }
    } catch {
      // Graceful fallback for missing data
    }

    return { progress: 0, target: threshold };
  },

  account_age_days: async (userId, config, supabase) => {
    const days = (config.days as number) || 365;
    try {
      const { data } = await supabase.auth.admin.getUserById(userId);
      if (!data?.user?.created_at) return { progress: 0, target: days };
      const ageDays = Math.floor((Date.now() - new Date(data.user.created_at).getTime()) / 86400000);
      return { progress: Math.min(ageDays, days), target: days };
    } catch {
      return { progress: 0, target: days };
    }
  },

  rewatch_count: async (_userId, config, _supabase) => {
    const threshold = (config.threshold as number) || 3;
    // Rewatch tracking not yet implemented — graceful 0
    return { progress: 0, target: threshold };
  },

  composite_check: async (userId, config, supabase) => {
    const conditions = config.conditions as string[];
    const target = conditions.length;
    let met = 0;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('avatar, display_name, username')
        .eq('user_id', userId)
        .limit(1);

      if (data && data.length > 0) {
        const profile = data[0];
        for (const cond of conditions) {
          if (cond === 'has_avatar' && profile.avatar) met++;
          if (cond === 'has_bio' && (profile.display_name || profile.username)) met++;
        }
      }
    } catch {
      // Graceful fallback
    }

    return { progress: met, target };
  },

  relational_check: async (userId, config, supabase) => {
    const check = config.check as string;

    try {
      if (check === 'completed_sequel_of_completed') {
        const { data: completed } = await supabase
          .from('watchlist_entries')
          .select('media_id, series_id')
          .eq('user_id', userId)
          .eq('watch_status', 'Completed')
          .not('series_id', 'is', null)
          .limit(5000);

        if (!completed || completed.length < 2) return { progress: 0, target: 1 };

        const seriesGroups = new Map<number, number[]>();
        for (const e of completed) {
          const sid = e.series_id as number;
          if (!seriesGroups.has(sid)) seriesGroups.set(sid, []);
          seriesGroups.get(sid)!.push(e.media_id as number);
        }

        for (const group of seriesGroups.values()) {
          if (group.length >= 2) return { progress: 1, target: 1 };
        }
      }

      if (check === 'all_franchise_entries_completed') {
        // Complex check — requires knowing all entries in a franchise
        // Graceful 0 until we have full franchise data
        return { progress: 0, target: 1 };
      }
    } catch {
      // Graceful fallback
    }

    return { progress: 0, target: 1 };
  },
};

export function getEvaluator(criteriaType: string): Evaluator | null {
  return evaluators[criteriaType] || null;
}
