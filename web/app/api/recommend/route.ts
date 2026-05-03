import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';

export const dynamic = 'force-dynamic';

const ANILIST_API = 'https://graphql.anilist.co';

const FILTERED_SEARCH_QUERY = `
query FilteredSearch($genres: [String], $status: MediaStatus, $sort: [MediaSort], $scoreGreater: Int, $page: Int) {
  Page(page: $page, perPage: 20) {
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

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const watchlistCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;

    const excludeIds = new Set<number>();
    let offset = 0;
    while (true) {
      const batch = await databases.listDocuments(dbId, watchlistCol, [
        Query.equal('user_id', userId),
        Query.limit(100),
        Query.offset(offset),
      ]);
      for (const d of batch.documents) {
        excludeIds.add(d.media_id as number);
        if (d.id_mal) excludeIds.add(d.id_mal as number);
      }
      if (batch.documents.length < 100) break;
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
