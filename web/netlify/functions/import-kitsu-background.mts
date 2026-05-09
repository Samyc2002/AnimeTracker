import type { Config } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { fetchKitsuUserId, fetchKitsuLibrary } from "../../lib/providers/kitsu.js";
import { mediaToWatchlistEntry } from "../../lib/anime-provider.js";
import { resolveKitsuToAniList } from "../../lib/providers/kitsu-resolve.js";
import { upsertSeriesMetadataBatch } from "../../lib/series-metadata.js";

const CHUNK_SIZE = 100;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { realtime: { transport: WebSocket as any } }
  );
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

    // Resolve Kitsu IDs → canonical AniList IDs before writing
    const kitsuIds = kitsuEntries.map((e) => e.media.id);
    const resolutions = await resolveKitsuToAniList(kitsuIds);
    const kitsuToAniList = new Map(resolutions.map((r) => [r.kitsuId, r.anilistId]));

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
    let updated = 0;
    let skipped = 0;

    for (const entry of kitsuEntries) {
      const canonicalAnilistId = kitsuToAniList.get(entry.media.id) ?? null;
      const docData: Record<string, unknown> = {
        ...mediaToWatchlistEntry(entry.media),
        user_id: userId,
        watch_status: entry.watchStatus,
        import_source: "kitsu",
        canonical_anilist_id: canonicalAnilistId,
      };

      const existingId = existingMap.get(entry.media.id);
      if (existingId) {
        await supabase.from("watchlist_entries").update(docData).eq("id", existingId);
        updated++;
      } else {
        toInsert.push(docData);
      }

      if (entry.progress > 0) {
        for (let ep = 1; ep <= entry.progress; ep++) {
          episodeRows.push({ user_id: userId, media_id: entry.media.id, episode_number: ep });
        }
      }
    }

    // Insert new entries in chunks
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from("watchlist_entries").insert(chunk);
      if (error?.code === "23505") {
        skipped += chunk.length;
      } else if (error) {
        console.error(`watchlist insert chunk ${i} error:`, error.message);
      }
    }

    // Upsert episodes
    await chunkUpsert(supabase, "watched_episodes", episodeRows, "user_id,media_id,episode_number");

    // Batch upsert series metadata from resolved entries
    const resolvedMedia = resolutions.filter((r) => r.media !== null).map((r) => r.media!);
    if (resolvedMedia.length > 0) await upsertSeriesMetadataBatch(supabase, resolvedMedia);

    // Record import timestamp
    await supabase.from("profiles").update({ kitsu_imported_at: new Date().toISOString() }).eq("user_id", userId);

    const created = toInsert.length - skipped;
    console.log(`Kitsu import done for ${userId}: ${created} created, ${updated} updated, ${skipped} skipped, total ${kitsuEntries.length}`);
    return new Response(
      JSON.stringify({ created, updated, skipped, total: kitsuEntries.length }),
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
