import type { Config } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CHUNK_SIZE = 100;
const KITSU_BASE = "https://kitsu.io/api/edge";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function fetchKitsuUserId(username: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${KITSU_BASE}/users?filter[name]=${encodeURIComponent(username)}&page[limit]=1`,
      { headers: { Accept: "application/vnd.api+json" } }
    );
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return null;
    const data = await res.json();
    if (!data.data || data.data.length === 0) return null;
    return parseInt(data.data[0].id, 10) || null;
  } catch {
    return null;
  }
}

const STATUS_MAP: Record<string, string> = {
  current: "Watching",
  planned: "Planned",
  completed: "Completed",
  dropped: "Dropped",
  on_hold: "Dropped",
};

interface KitsuEntry {
  mediaId: number;
  status: string;
  progress: number;
  title: string;
  coverUrl: string;
  totalEpisodes: number | null;
}

async function fetchKitsuLibrary(userId: number): Promise<KitsuEntry[]> {
  const entries: KitsuEntry[] = [];
  let nextUrl: string | null = `${KITSU_BASE}/library-entries?filter[userId]=${userId}&filter[kind]=anime&include=anime&page[limit]=20&sort=-updatedAt`;

  while (nextUrl) {
    const fullUrl: string = nextUrl.startsWith("http") ? nextUrl : `${KITSU_BASE}${nextUrl}`;
    const res: Response = await fetch(fullUrl, {
      headers: { Accept: "application/vnd.api+json" },
    });
    if (!res.ok) break;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) break;

    const data: Record<string, unknown> = await res.json();
    const included = new Map<string, Record<string, unknown>>();
    for (const inc of (data.included as Record<string, unknown>[] || [])) {
      if (inc.type === "anime") included.set(inc.id as string, inc);
    }

    for (const entry of (data.data as Record<string, unknown>[] || [])) {
      const attrs = (entry.attributes as Record<string, unknown>) || {};
      const relationships = (entry.relationships as Record<string, unknown>) || {};
      const animeRel = (relationships.anime as Record<string, unknown>) || {};
      const animeRef = (animeRel.data as Record<string, unknown>) || null;
      if (!animeRef) continue;
      const anime = included.get(animeRef.id as string);
      if (!anime) continue;
      const animeAttrs = (anime.attributes as Record<string, unknown>) || {};
      const poster = (animeAttrs.posterImage as Record<string, string>) || {};

      entries.push({
        mediaId: parseInt(anime.id as string, 10),
        status: STATUS_MAP[attrs.status as string] || "Watching",
        progress: (attrs.progress as number) || 0,
        title: (animeAttrs.canonicalTitle as string) || "Unknown",
        coverUrl: poster.large || poster.medium || poster.small || "",
        totalEpisodes: (animeAttrs.episodeCount as number) || null,
      });
    }

    const links = data.links as Record<string, unknown>;
    nextUrl = (links?.next as string) || null;
  }

  return entries;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function chunkUpsert(supabase: SupabaseClient<any>, table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await supabase.from(table).upsert(rows.slice(i, i + CHUNK_SIZE), { onConflict });
  }
}

export default async (req: Request) => {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400 });
    }

    const supabase = getSupabase();

    const { data: profiles } = await supabase
      .from("profiles")
      .select("kitsu_username")
      .eq("user_id", userId)
      .limit(1);

    const kitsuUsername = (profiles?.[0]?.kitsu_username as string) || null;
    if (!kitsuUsername) {
      return new Response(JSON.stringify({ error: "Kitsu not connected" }), { status: 400 });
    }

    const kitsuUserId = await fetchKitsuUserId(kitsuUsername);
    if (!kitsuUserId) {
      return new Response(
        JSON.stringify({ error: `Kitsu user "${kitsuUsername}" not found.` }),
        { status: 404 }
      );
    }

    const kitsuEntries = await fetchKitsuLibrary(kitsuUserId);
    if (kitsuEntries.length === 0) {
      return new Response(
        JSON.stringify({ error: "No anime found. Library may be private.", possiblePrivate: true }),
        { status: 404 }
      );
    }

    const { data: existingDocs } = await supabase
      .from("watchlist_entries")
      .select("media_id, id")
      .eq("user_id", userId)
      .limit(5000);

    const existingMap = new Map(
      (existingDocs || []).map((d) => [d.media_id as number, d.id as string])
    );

    const toInsert: Record<string, unknown>[] = [];
    const episodeRows: Record<string, unknown>[] = [];

    for (const entry of kitsuEntries) {
      const docData: Record<string, unknown> = {
        user_id: userId,
        media_id: entry.mediaId,
        title_romaji: entry.title,
        title_english: entry.title,
        cover_url: entry.coverUrl,
        status: "FINISHED",
        total_episodes: entry.totalEpisodes,
        next_airing_episode: null,
        next_airing_at: null,
        watch_status: entry.status,
        is_adult: false,
        series_id: null,
        id_mal: null,
      };

      const existingId = existingMap.get(entry.mediaId);
      if (existingId) {
        await supabase.from("watchlist_entries").update(docData).eq("id", existingId);
      } else {
        toInsert.push(docData);
      }

      for (let ep = 1; ep <= entry.progress; ep++) {
        episodeRows.push({ user_id: userId, media_id: entry.mediaId, episode_number: ep });
      }
    }

    await chunkUpsert(supabase, "watchlist_entries", toInsert, "user_id,media_id");
    await chunkUpsert(supabase, "watched_episodes", episodeRows, "user_id,media_id,episode_number");

    console.log(`Kitsu import done for ${userId}: ${toInsert.length} created, total ${kitsuEntries.length}`);
    return new Response(
      JSON.stringify({ created: toInsert.length, updated: existingMap.size, total: kitsuEntries.length }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Kitsu import failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Import failed" }),
      { status: 500 }
    );
  }
};

// Named *-background.mts so Netlify treats this as a background function (15min timeout)
export const config: Config = {};
