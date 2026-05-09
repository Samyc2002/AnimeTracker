import { NextRequest } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ANILIST_API = 'https://graphql.anilist.co';
const KITSU_BASE = 'https://kitsu.io/api/edge';

const ANILIST_ID_BATCH_QUERY = `
query VerifyIds($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) { id }
  }
}`;

const ANILIST_MAL_BATCH_QUERY = `
query ResolveByMalIds($malIds: [Int]) {
  Page(perPage: 50) {
    media(idMal_in: $malIds, type: ANIME) { id idMal }
  }
}`;

const ANILIST_TITLE_SEARCH_QUERY = `
query SearchByTitle($title: String) {
  Page(perPage: 3) {
    media(search: $title, type: ANIME) { id title { romaji english } }
  }
}`;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function titlesMatch(stored: string, candidate: string): boolean {
  const a = stored.toLowerCase().trim();
  const b = candidate.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
}

async function searchAniListByTitle(title: string): Promise<number | null> {
  try {
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: ANILIST_TITLE_SEARCH_QUERY, variables: { title } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.data?.Page?.media ?? [];
    for (const m of results) {
      if (titlesMatch(title, m.title?.romaji ?? '') || titlesMatch(title, m.title?.english ?? '')) {
        return m.id;
      }
    }
    return null;
  } catch { return null; }
}

// Batch-verify a list of media_ids against AniList id_in — returns set of valid AniList IDs
async function batchVerifyAniListIds(mediaIds: number[]): Promise<Set<number>> {
  const valid = new Set<number>();
  for (let i = 0; i < mediaIds.length; i += 50) {
    const batch = mediaIds.slice(i, i + 50);
    try {
      const res = await fetch(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ANILIST_ID_BATCH_QUERY, variables: { ids: batch } }),
      });
      if (res.ok) {
        const data = await res.json();
        for (const media of data?.data?.Page?.media ?? []) {
          if (media.id) valid.add(media.id);
        }
      }
    } catch { /* batch failed, none added as valid */ }
    if (i + 50 < mediaIds.length) await sleep(1100);
  }
  return valid;
}

async function fetchKitsuMalId(kitsuId: number): Promise<number | null> {
  try {
    const res = await fetch(
      `${KITSU_BASE}/anime/${kitsuId}/mappings?filter[externalSite]=myanimelist%2Fanime&page[limit]=1`,
      { headers: { Accept: 'application/vnd.api+json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entry = data?.data?.[0];
    if (!entry) return null;
    const malId = parseInt(entry.attributes?.externalId, 10);
    return isNaN(malId) ? null : malId;
  } catch { return null; }
}

async function resolveMalIdsToAniList(malIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  for (let i = 0; i < malIds.length; i += 50) {
    const batch = malIds.slice(i, i + 50);
    try {
      const res = await fetch(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ANILIST_MAL_BATCH_QUERY, variables: { malIds: batch } }),
      });
      if (res.ok) {
        const data = await res.json();
        for (const media of data?.data?.Page?.media ?? []) {
          if (media.id && media.idMal) result.set(media.idMal, media.id);
        }
      }
    } catch { /* batch failed */ }
    if (i + 50 < malIds.length) await sleep(1100);
  }
  return result;
}

export async function POST(req: NextRequest) {
  const { dryRun = true, userId: scopeUserId } = await req.json();
  const supabase = getServiceSupabase();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function emit(msg: string) {
        const line = `[${new Date().toISOString()}] ${msg}`;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`));
      }

      const counters = { direct: 0, verified: 0, kitsu: 0, unresolved: 0, errors: 0 };

      try {
        emit(`Starting — dry_run=${dryRun} scope=${scopeUserId ?? 'all users'}`);

        // ----------------------------------------------------------------
        // Phase 1: id_mal IS NOT NULL → direct AniList, no API calls
        // ----------------------------------------------------------------
        emit('--- Phase 1: rows with id_mal set (case a, no API calls) ---');
        let q1 = supabase
          .from('watchlist_entries')
          .select('id, media_id, id_mal')
          .is('canonical_anilist_id', null)
          .not('id_mal', 'is', null)
          .limit(10000);
        if (scopeUserId) q1 = q1.eq('user_id', scopeUserId);

        const { data: phase1Rows, error: p1err } = await q1;
        if (p1err) { emit(`ERROR: ${p1err.message}`); controller.close(); return; }

        emit(`Phase 1: ${(phase1Rows || []).length} rows to process`);
        for (const row of (phase1Rows || [])) {
          if (!dryRun) {
            const { error } = await supabase
              .from('watchlist_entries')
              .update({ canonical_anilist_id: row.media_id, import_source: 'anilist' })
              .eq('id', row.id);
            if (error) { counters.errors++; emit(`ERROR row=${row.id}: ${error.message}`); continue; }
          }
          counters.direct++;
          emit(`case=a  row=${row.id}  media_id=${row.media_id}  outcome=resolved:anilist:direct`);
        }
        emit(`[checkpoint] Phase 1 complete: ${counters.direct} direct. Starting phase 2.`);

        // ----------------------------------------------------------------
        // Phase 2: id_mal IS NULL → ambiguous, batch AniList verify first
        // ----------------------------------------------------------------
        let q2 = supabase
          .from('watchlist_entries')
          .select('id, media_id')
          .is('canonical_anilist_id', null)
          .is('id_mal', null)
          .limit(10000);
        if (scopeUserId) q2 = q2.eq('user_id', scopeUserId);

        const { data: phase2Rows, error: p2err } = await q2;
        if (p2err) { emit(`ERROR: ${p2err.message}`); controller.close(); return; }

        const allMediaIds = (phase2Rows || []).map((r) => r.media_id as number);
        emit(`Phase 2: ${allMediaIds.length} rows — batch-verifying against AniList id_in (${Math.ceil(allMediaIds.length / 50)} requests)`);

        // Batch verify all media_ids against AniList at once
        const validAniListIds = await batchVerifyAniListIds(allMediaIds);
        emit(`Phase 2: ${validAniListIds.size} confirmed as AniList IDs, ${allMediaIds.length - validAniListIds.size} need Kitsu lookup`);

        // Split into resolved (case b) and kitsu-pending (case c)
        const anilistResolved = (phase2Rows || []).filter((r) => validAniListIds.has(r.media_id as number));
        const kitsuCandidates = (phase2Rows || []).filter((r) => !validAniListIds.has(r.media_id as number));

        // Write case (b) — AniList verified
        for (const row of anilistResolved) {
          if (!dryRun) {
            const { error } = await supabase
              .from('watchlist_entries')
              .update({ canonical_anilist_id: row.media_id, import_source: 'anilist' })
              .eq('id', row.id);
            if (error) { counters.errors++; emit(`ERROR row=${row.id}: ${error.message}`); continue; }
          }
          counters.verified++;
          emit(`case=b  row=${row.id}  media_id=${row.media_id}  outcome=resolved:anilist:verified`);
        }

        emit(`[checkpoint] Phase 2a complete: ${counters.verified} anilist verified. Starting Kitsu lookup for ${kitsuCandidates.length} rows.`);

        // ----------------------------------------------------------------
        // Phase 2b: Kitsu lookup — sequential (Kitsu has no batch endpoint)
        // ----------------------------------------------------------------
        const kitsuPending: { id: string; mediaId: number; malId: number }[] = [];

        for (let i = 0; i < kitsuCandidates.length; i++) {
          const row = kitsuCandidates[i];
          const malId = await fetchKitsuMalId(row.media_id as number);
          await sleep(300);

          if (malId !== null) {
            kitsuPending.push({ id: row.id as string, mediaId: row.media_id as number, malId });
            emit(`case=c  row=${row.id}  media_id=${row.media_id}  kitsu_mal_id=${malId}  outcome=kitsu_pending`);
          } else {
            if (!dryRun) {
              await supabase.from('watchlist_entries').update({ import_source: 'unresolved' }).eq('id', row.id);
            }
            counters.unresolved++;
            emit(`case=d  row=${row.id}  media_id=${row.media_id}  outcome=unresolved:no_kitsu_mapping`);
          }

          if ((i + 1) % 50 === 0) {
            emit(`[progress] Kitsu lookup: ${i + 1}/${kitsuCandidates.length}`);
          }
        }

        // ----------------------------------------------------------------
        // Phase 2c: batch MAL → AniList for Kitsu-pending rows
        // ----------------------------------------------------------------
        if (kitsuPending.length > 0) {
          emit(`Phase 2c: batch-resolving ${kitsuPending.length} Kitsu rows via MAL IDs`);
          const malIds = kitsuPending.map((p) => p.malId);
          const anilistMap = await resolveMalIdsToAniList(malIds);

          for (const { id, mediaId, malId } of kitsuPending) {
            const anilistId = anilistMap.get(malId) ?? null;
            if (anilistId !== null) {
              if (!dryRun) {
                const { error } = await supabase
                  .from('watchlist_entries')
                  .update({ canonical_anilist_id: anilistId, import_source: 'kitsu' })
                  .eq('id', id);
                if (error) { counters.errors++; emit(`ERROR row=${id}: ${error.message}`); continue; }
              }
              counters.kitsu++;
              emit(`case=c  row=${id}  media_id=${mediaId}  mal_id=${malId}  canonical=${anilistId}  outcome=resolved:kitsu`);
            } else {
              if (!dryRun) {
                await supabase.from('watchlist_entries').update({ import_source: 'unresolved' }).eq('id', id);
              }
              counters.unresolved++;
              emit(`case=d  row=${id}  media_id=${mediaId}  mal_id=${malId}  outcome=unresolved:mal_not_on_anilist`);
            }
          }
        }

        // ----------------------------------------------------------------
        // Phase 2d: title-search fallback for unresolved rows
        // Handles Kitsu entries with no MAL mapping (new seasonal shows, etc.)
        // ----------------------------------------------------------------
        let qUnresolved = supabase
          .from('watchlist_entries')
          .select('id, media_id, title_romaji, title_english')
          .eq('import_source', 'unresolved')
          .is('canonical_anilist_id', null)
          .limit(10000);
        if (scopeUserId) qUnresolved = qUnresolved.eq('user_id', scopeUserId);

        const { data: unresolvedRows, error: urErr } = await qUnresolved;
        if (urErr) { emit(`ERROR fetching unresolved rows: ${urErr.message}`); }
        else if ((unresolvedRows || []).length > 0) {
          emit(`Phase 2d: title-search fallback for ${unresolvedRows!.length} unresolved rows`);
          let titleResolved = 0;
          let titleFailed = 0;

          for (let i = 0; i < unresolvedRows!.length; i++) {
            const row = unresolvedRows![i];
            const title = (row.title_romaji || row.title_english || '') as string;
            if (!title) { titleFailed++; continue; }

            const anilistId = await searchAniListByTitle(title);
            await sleep(1100);

            if (anilistId !== null) {
              if (!dryRun) {
                const { error } = await supabase
                  .from('watchlist_entries')
                  .update({ canonical_anilist_id: anilistId, import_source: 'kitsu' })
                  .eq('id', row.id);
                if (error) { counters.errors++; emit(`ERROR row=${row.id}: ${error.message}`); continue; }
              }
              counters.kitsu++;
              titleResolved++;
              emit(`case=e  row=${row.id}  media_id=${row.media_id}  title="${title}"  canonical=${anilistId}  outcome=resolved:title_search`);
            } else {
              titleFailed++;
              emit(`case=e  row=${row.id}  media_id=${row.media_id}  title="${title}"  outcome=unresolved:title_no_match`);
            }

            if ((i + 1) % 20 === 0) {
              emit(`[progress] Title search: ${i + 1}/${unresolvedRows!.length} (resolved=${titleResolved} failed=${titleFailed})`);
            }
          }
          emit(`[checkpoint] Phase 2d complete: ${titleResolved} resolved by title, ${titleFailed} still unresolved`);
        }

        // Final report
        emit('--- DONE ---');
        emit(`REPORT ${JSON.stringify({
          dry_run: dryRun,
          scoped: !!scopeUserId,
          resolved_anilist_direct: counters.direct,
          resolved_anilist_verified: counters.verified,
          resolved_kitsu: counters.kitsu,
          unresolved: counters.unresolved,
          errors: counters.errors,
        })}`);

      } catch (err) {
        emit(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
