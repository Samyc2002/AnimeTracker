import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

const ANILIST_API = 'https://graphql.anilist.co';

const AIRING_QUERY = `
query AiringSchedule($mediaIds: [Int], $from: Int, $to: Int) {
  Page(perPage: 50) {
    airingSchedules(
      mediaId_in: $mediaIds,
      airingAt_greater: $from,
      airingAt_lesser: $to
    ) {
      mediaId
      episode
      airingAt
    }
  }
}`;

const pollCache = new Map<string, number>();
const POLL_COOLDOWN = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const lastPoll = pollCache.get(userId) || 0;
    if (Date.now() - lastPoll < POLL_COOLDOWN) {
      return NextResponse.json({ created: 0, cached: true });
    }
    pollCache.set(userId, Date.now());

    const supabase = getServiceSupabase();

    const { data: watchlistDocs, error: watchlistError } = await supabase
      .from('watchlist_entries')
      .select()
      .eq('user_id', userId)
      .limit(500);

    if (watchlistError) throw watchlistError;

    const mediaIds = (watchlistDocs || []).map((d) => d.media_id as number);
    if (mediaIds.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;

    const anilistRes = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: AIRING_QUERY,
        variables: { mediaIds, from: oneDayAgo, to: now },
      }),
    });

    if (!anilistRes.ok) {
      pollCache.delete(userId);
      return NextResponse.json({ error: 'AniList API error' }, { status: 502 });
    }

    const anilistData = await anilistRes.json();
    const schedules = anilistData.data?.Page?.airingSchedules || [];

    const { data: existingDocs, error: existingError } = await supabase
      .from('notifications')
      .select()
      .eq('user_id', userId)
      .gt('created_at', new Date(oneDayAgo * 1000).toISOString())
      .limit(500);

    if (existingError) throw existingError;

    const existingKeys = new Set(
      (existingDocs || []).map((d) => `${d.media_id}-${d.episode}`)
    );

    const watchlistMap = new Map(
      (watchlistDocs || []).map((d) => [d.media_id as number, d])
    );

    let created = 0;

    for (const schedule of schedules) {
      const key = `${schedule.mediaId}-${schedule.episode}`;
      if (existingKeys.has(key)) continue;

      const wlEntry = watchlistMap.get(schedule.mediaId);
      if (!wlEntry) continue;

      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          media_id: schedule.mediaId,
          episode: schedule.episode,
          title: (wlEntry.title_english as string) || (wlEntry.title_romaji as string) || 'Unknown',
          cover_url: wlEntry.cover_url as string,
          airing_at: schedule.airingAt,
          is_read: false,
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;
      created++;
    }

    return NextResponse.json({ created });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Poll failed' },
      { status: 500 },
    );
  }
}
