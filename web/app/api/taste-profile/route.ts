import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';
import { buildTasteProfile, generateQuestions } from '@/lib/taste-profile';

export const dynamic = 'force-dynamic';

const profileCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const watchlistCol = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;
    const cacheCol = process.env.NEXT_PUBLIC_APPWRITE_ANIME_CACHE_COLLECTION_ID!;

    const watchlist = await databases.listDocuments(dbId, watchlistCol, [
      Query.equal('user_id', userId),
      Query.equal('watch_status', 'Completed'),
      Query.limit(500),
      Query.select(['media_id']),
    ]);

    const mediaIds = watchlist.documents.map((d) => d.media_id as number);

    if (mediaIds.length < 3) {
      return NextResponse.json({
        profile: null,
        questions: [],
        insufficient: true,
        totalCompleted: mediaIds.length,
      });
    }

    const cacheDocs: { genres: string | null; studio: string | null; average_score: number | null; episodes: number | null }[] = [];

    for (let i = 0; i < mediaIds.length; i += 100) {
      const batch = mediaIds.slice(i, i + 100);
      const res = await databases.listDocuments(dbId, cacheCol, [
        Query.equal('anilist_id', batch),
        Query.limit(100),
        Query.select(['genres', 'studio', 'average_score', 'episodes']),
      ]);
      for (const doc of res.documents) {
        cacheDocs.push({
          genres: (doc.genres as string) || null,
          studio: (doc.studio as string) || null,
          average_score: (doc.average_score as number) ?? null,
          episodes: (doc.episodes as number) ?? null,
        });
      }
    }

    const profile = buildTasteProfile(cacheDocs);
    profile.totalCompleted = mediaIds.length;
    const questions = generateQuestions(profile);

    const result = { profile, questions, insufficient: false };
    profileCache.set(userId, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build taste profile' },
      { status: 500 },
    );
  }
}
