import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ANILIST_API = 'https://graphql.anilist.co';

const BATCH_RELATIONS_QUERY = `
query BatchRelations($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      relations {
        edges {
          relationType
          node {
            id
            title { romaji english }
            coverImage { extraLarge large medium }
            type
            status
          }
        }
      }
    }
  }
}`;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SequelInfo {
  id: number;
  title: string;
  coverUrl: string;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchSize = 100;
  const offset = Number(req.nextUrl.searchParams.get('offset') || '0');

  try {
    const supabase = getServiceSupabase();

    const { data: resDocs, error: resError } = await supabase
      .from('watchlist_entries')
      .select('user_id, media_id')
      .eq('watch_status', 'Completed')
      .range(offset, offset + batchSize - 1);

    if (resError) throw resError;

    if (!resDocs || resDocs.length === 0) {
      return NextResponse.json({ processed: 0, created: 0, offset, done: true });
    }

    const userMediaMap = new Map<string, number[]>();
    for (const doc of resDocs) {
      const userId = doc.user_id as string;
      const mediaId = doc.media_id as number;
      if (!userMediaMap.has(userId)) userMediaMap.set(userId, []);
      userMediaMap.get(userId)!.push(mediaId);
    }

    let created = 0;

    for (const [userId, mediaIds] of userMediaMap) {
      const uniqueIds = [...new Set(mediaIds)];

      const { data: allWatchlistDocs } = await supabase
        .from('watchlist_entries')
        .select('media_id')
        .eq('user_id', userId)
        .limit(500);

      const trackedMediaIds = new Set((allWatchlistDocs || []).map((d) => d.media_id as number));

      for (let i = 0; i < uniqueIds.length; i += 50) {
        const batch = uniqueIds.slice(i, i + 50);

        const anilistRes = await fetch(ANILIST_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: BATCH_RELATIONS_QUERY,
            variables: { ids: batch },
          }),
        });

        if (!anilistRes.ok) {
          if (anilistRes.status === 429) {
            await delay(60_000);
            i -= 50;
            continue;
          }
          continue;
        }

        const data = await anilistRes.json();
        const mediaList = data.data?.Page?.media || [];

        const sequels: SequelInfo[] = [];

        for (const media of mediaList) {
          for (const edge of media.relations?.edges || []) {
            if (
              edge.relationType === 'SEQUEL' &&
              edge.node.type === 'ANIME' &&
              edge.node.status === 'NOT_YET_RELEASED'
            ) {
              sequels.push({
                id: edge.node.id,
                title: edge.node.title?.english || edge.node.title?.romaji || 'Unknown',
                coverUrl: edge.node.coverImage?.extraLarge || edge.node.coverImage?.large || edge.node.coverImage?.medium || '',
              });
            }
          }
        }

        for (const sequel of sequels) {
          if (trackedMediaIds.has(sequel.id)) continue;

          const { data: existingDocs } = await supabase
            .from('notifications')
            .select()
            .eq('user_id', userId)
            .eq('media_id', sequel.id)
            .eq('type', 'sequel')
            .limit(1);

          if (existingDocs && existingDocs.length > 0) continue;

          await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              media_id: sequel.id,
              episode: 0,
              title: sequel.title,
              cover_url: sequel.coverUrl,
              airing_at: 0,
              is_read: false,
              type: 'sequel',
              created_at: new Date().toISOString(),
            });

          created++;
        }

        await delay(1000);
      }
    }

    const done = resDocs.length < batchSize;

    return NextResponse.json({
      processed: resDocs.length,
      created,
      offset,
      done,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sequel scan failed' },
      { status: 500 },
    );
  }
}
