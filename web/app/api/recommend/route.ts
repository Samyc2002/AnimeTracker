import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ANILIST_API = 'https://graphql.anilist.co';

const FILTERED_SEARCH_QUERY = `
query FilteredSearch($genres: [String], $status: MediaStatus, $sort: [MediaSort], $scoreGreater: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(
      type: ANIME,
      genre_in: $genres,
      status: $status,
      sort: $sort,
      averageScore_greater: $scoreGreater,
      isAdult: false
    ) {
      id
      idMal
      title { romaji english }
      coverImage { extraLarge large medium }
      status
      episodes
      isAdult
      averageScore
      genres
      nextAiringEpisode { airingAt episode }
    }
  }
}`;

export async function POST(req: NextRequest) {
  try {
    const { userId, filters } = await req.json();
    if (!userId || !filters) {
      return NextResponse.json({ error: 'Missing userId or filters' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const excludeIds = new Set<number>();
    let offset = 0;
    while (true) {
      const { data: batchDocs } = await supabase
        .from('watchlist_entries')
        .select()
        .eq('user_id', userId)
        .range(offset, offset + 99);

      const batch = batchDocs || [];
      for (const d of batch) {
        excludeIds.add(d.media_id as number);
        if (d.id_mal) excludeIds.add(d.id_mal as number);
      }
      if (batch.length < 100) break;
      offset += 100;
    }

    const variables: Record<string, unknown> = {
      page: 1,
      sort: [filters.sort || 'SCORE_DESC'],
    };
    if (filters.genres?.length) variables.genres = filters.genres;
    if (filters.status) variables.status = filters.status;
    if (filters.minScore) variables.scoreGreater = filters.minScore;

    const anilistRes = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: FILTERED_SEARCH_QUERY, variables }),
    });

    if (!anilistRes.ok) {
      return NextResponse.json({ error: 'AniList API error' }, { status: 502 });
    }

    const data = await anilistRes.json();
    let media = data.data?.Page?.media || [];

    media = media.filter((m: { id: number; idMal: number | null; episodes: number | null }) => {
      if (excludeIds.has(m.id)) return false;
      if (m.idMal && excludeIds.has(m.idMal)) return false;
      if (filters.maxEpisodes != null && m.episodes != null && m.episodes > filters.maxEpisodes) return false;
      return true;
    });

    if (media.length === 0 && filters.genres?.length) {
      const fallbackVars: Record<string, unknown> = {
        page: 1,
        sort: [filters.sort || 'SCORE_DESC'],
        scoreGreater: filters.minScore || 60,
      };
      if (filters.status) fallbackVars.status = filters.status;

      const fallbackRes = await fetch(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: FILTERED_SEARCH_QUERY, variables: fallbackVars }),
      });

      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        media = (fallbackData.data?.Page?.media || []).filter(
          (m: { id: number; idMal: number | null }) => !excludeIds.has(m.id) && !(m.idMal && excludeIds.has(m.idMal)),
        );
      }
    }

    return NextResponse.json({ results: media });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Recommendation failed' },
      { status: 500 },
    );
  }
}
