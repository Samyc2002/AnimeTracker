import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import type { WatchStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const WATCH_STATUSES: WatchStatus[] = ['Watching', 'Planned', 'Completed', 'Dropped'];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const sp = req.nextUrl.searchParams;

  const status = sp.get('status') as WatchStatus | null;
  const airingStatuses = sp.getAll('airing_statuses');
  const genres = sp.getAll('genres');
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(sp.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  if (status && !WATCH_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    const { data: profileDocs } = await supabase
      .from('profiles')
      .select('user_id, is_public, hide_nsfw_public')
      .eq('username', username)
      .limit(1);

    if (!profileDocs || profileDocs.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profileDocs[0];
    if (!profile.is_public) {
      return NextResponse.json({ error: 'Profile is private' }, { status: 403 });
    }

    const userId = profile.user_id as string;
    const hideNsfw = !!profile.hide_nsfw_public;

    // True counts per bucket — parallel exact-count queries, unaffected by filters/pagination
    const countQueries = WATCH_STATUSES.map((ws) => {
      let q = supabase
        .from('watchlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('watch_status', ws);
      if (hideNsfw) q = q.eq('is_adult', false).eq('manual_nsfw', false);
      return q;
    });
    const countResults = await Promise.all(countQueries);
    const counts: Record<string, number> = { All: 0 };
    for (let i = 0; i < WATCH_STATUSES.length; i++) {
      const c = countResults[i].count ?? 0;
      counts[WATCH_STATUSES[i]] = c;
      counts.All += c;
    }

    // Resolve genre filter to a set of canonical_anilist_ids
    let genreMatchIds: number[] | null = null;
    if (genres.length > 0) {
      const { data: matchingMeta } = await supabase
        .from('series_metadata')
        .select('anilist_id')
        .overlaps('genres', genres);

      genreMatchIds = (matchingMeta || []).map((r) => r.anilist_id as number);

      if (genreMatchIds.length === 0) {
        return NextResponse.json({ entries: [], counts, hasMore: false, totalFiltered: 0 });
      }
    }

    // Build entries query with all filters
    let query = supabase
      .from('watchlist_entries')
      .select('media_id, canonical_anilist_id, title_romaji, title_english, cover_url, status, total_episodes, watch_status, is_adult, manual_nsfw')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('watch_status', status);
    if (airingStatuses.length > 0) query = query.in('status', airingStatuses);
    if (hideNsfw) query = query.eq('is_adult', false).eq('manual_nsfw', false);
    if (genreMatchIds) query = query.in('canonical_anilist_id', genreMatchIds);

    // Filtered count (same filters, no pagination)
    let filteredCountQuery = supabase
      .from('watchlist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (status) filteredCountQuery = filteredCountQuery.eq('watch_status', status);
    if (airingStatuses.length > 0) filteredCountQuery = filteredCountQuery.in('status', airingStatuses);
    if (hideNsfw) filteredCountQuery = filteredCountQuery.eq('is_adult', false).eq('manual_nsfw', false);
    if (genreMatchIds) filteredCountQuery = filteredCountQuery.in('canonical_anilist_id', genreMatchIds);

    // Run entries + filtered count in parallel
    const [entriesResult, filteredCountResult] = await Promise.all([
      query.range(offset, offset + limit - 1),
      filteredCountQuery,
    ]);

    if (entriesResult.error) throw entriesResult.error;

    const totalFiltered = filteredCountResult.count ?? 0;
    const entries = (entriesResult.data || []).map((doc) => ({
      media_id: doc.media_id as number,
      canonical_anilist_id: doc.canonical_anilist_id as number | null,
      title_romaji: doc.title_romaji as string | null,
      title_english: doc.title_english as string | null,
      cover_url: doc.cover_url as string,
      status: doc.status as string,
      total_episodes: doc.total_episodes as number | null,
      watch_status: (doc.watch_status as WatchStatus) || 'Watching',
      is_nsfw: !!(doc.is_adult || doc.manual_nsfw),
    }));

    return NextResponse.json({
      entries,
      counts,
      hasMore: offset + entries.length < totalFiltered,
      totalFiltered,
    });
  } catch (err) {
    console.error('[profile/watchlist] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
  }
}
