import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const JIKAN_BASE = 'https://api.jikan.moe/v4';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapStatus(status: string): string {
  switch (status) {
    case 'Currently Airing': return 'RELEASING';
    case 'Finished Airing': return 'FINISHED';
    case 'Not yet aired': return 'NOT_YET_RELEASED';
    default: return 'FINISHED';
  }
}

function parseDuration(str: string | null): number | null {
  if (!str) return null;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

export async function POST(req: NextRequest) {
  try {
    const { malIds } = await req.json();
    if (!Array.isArray(malIds) || malIds.length === 0) {
      return NextResponse.json({ cached: 0 });
    }

    const supabase = getServiceSupabase();

    let cached = 0;

    for (const malId of malIds.slice(0, 10)) {
      try {
        const { data: existingDocs } = await supabase
          .from('anime_cache')
          .select()
          .eq('mal_id', malId)
          .limit(1);

        if (existingDocs && existingDocs.length > 0 && existingDocs[0].relations_json) continue;

        await delay(1000);
        const res = await fetch(`${JIKAN_BASE}/anime/${malId}/full`, {
          headers: { 'User-Agent': 'AnimeTracker/1.0' },
        });
        if (!res.ok) continue;

        const { data: item } = await res.json();
        if (!item) continue;

        const relations: { edges: { relationType: string; node: { id: number; title: { romaji: string; english: string | null }; coverImage: { extraLarge: string; large: string; medium: string }; type: string; status: string } }[] } = { edges: [] };
        if (Array.isArray(item.relations)) {
          for (const rel of item.relations) {
            const typeMap: Record<string, string> = { 'Prequel': 'PREQUEL', 'Sequel': 'SEQUEL', 'Side Story': 'SIDE_STORY', 'Parent Story': 'PARENT', 'Spin-Off': 'SPIN_OFF', 'Alternative Version': 'ALTERNATIVE', 'Summary': 'SUMMARY' };
            const relationType = typeMap[rel.relation] || 'OTHER';
            for (const entry of rel.entry || []) {
              if (entry.type !== 'anime') continue;
              relations.edges.push({
                relationType,
                node: {
                  id: entry.mal_id,
                  title: { romaji: entry.name || '', english: null },
                  coverImage: { extraLarge: '', large: '', medium: '' },
                  type: 'ANIME',
                  status: '',
                },
              });
            }
          }
        }

        const doc = {
          anilist_id: null,
          mal_id: item.mal_id,
          kitsu_id: null,
          title_romaji: item.title || 'Unknown',
          title_english: item.title_english || null,
          title_native: item.title_japanese || null,
          cover_small: item.images?.jpg?.image_url || null,
          cover_medium: item.images?.jpg?.large_image_url || null,
          cover_large: item.images?.jpg?.large_image_url || null,
          banner_image: null,
          description: item.synopsis || null,
          status: mapStatus(item.status || ''),
          episodes: item.episodes || null,
          duration: parseDuration(item.duration),
          season: item.season || null,
          season_year: item.year || null,
          genres: (item.genres || []).map((g: { name: string }) => g.name).join(', ') || null,
          is_adult: typeof item.rating === 'string' && item.rating.includes('Rx'),
          average_score: typeof item.score === 'number' ? Math.round(item.score * 10) : null,
          studio: (item.studios || [])[0]?.name || null,
          next_airing_episode: null,
          next_airing_at: null,
          relations_json: JSON.stringify(relations),
          updated_at: new Date().toISOString(),
        };

        if (existingDocs && existingDocs.length > 0) {
          await supabase.from('anime_cache').update(doc).eq('id', existingDocs[0].id);
        } else {
          await supabase.from('anime_cache').insert(doc);
        }
        cached++;
      } catch {
        // Skip failed entries
      }
    }

    return NextResponse.json({ cached });
  } catch {
    return NextResponse.json({ cached: 0 });
  }
}
