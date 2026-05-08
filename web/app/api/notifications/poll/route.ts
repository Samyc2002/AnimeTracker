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
    const threeDaysAgo = now - 3 * 86400;

    let schedules: { mediaId: number; episode: number; airingAt: number }[] = [];

    try {
      const anilistRes = await fetch(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: AIRING_QUERY,
          variables: { mediaIds, from: threeDaysAgo, to: now },
        }),
      });

      if (anilistRes.ok) {
        const anilistData = await anilistRes.json();
        schedules = anilistData.data?.Page?.airingSchedules || [];
      }
    } catch {
      // AniList down — try Jikan fallback
    }

    if (schedules.length === 0) {
      try {
        for (const doc of (watchlistDocs || []).slice(0, 20)) {
          const malId = (doc.id_mal as number) || (doc.media_id as number);
          const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
          if (!jikanRes.ok) continue;
          const jikanData = await jikanRes.json();
          const airing = jikanData.data?.airing;
          if (airing && jikanData.data?.episodes) {
            const latestEp = jikanData.data.episodes;
            const broadcastTime = jikanData.data?.broadcast?.time;
            if (broadcastTime) {
              schedules.push({
                mediaId: doc.media_id as number,
                episode: latestEp,
                airingAt: now - 3600,
              });
            }
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch {
        // Jikan also failed — give up
      }
    }

    if (schedules.length === 0) {
      pollCache.delete(userId);
      return NextResponse.json({ created: 0, provider_down: true });
    }

    const { data: existingDocs, error: existingError } = await supabase
      .from('notifications')
      .select()
      .eq('user_id', userId)
      .gt('created_at', new Date(threeDaysAgo * 1000).toISOString())
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
