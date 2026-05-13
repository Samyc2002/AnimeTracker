// Fire-and-stream: client connects, traversal runs, result arrives in stream.
// No /api/franchise/status polling endpoint needed — SSE replaces fire-and-poll.
// Server-side traversal continues to completion even if client disconnects
// (navigation, tab close). Result lands in franchise_watch_orders for next visit.

import { NextRequest } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { computeFranchiseWatchOrder } from '@/lib/franchise-traversal';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const KEEPALIVE_MS = 15_000;

async function resolveCanonicalAnilistId(
  id: number,
  supabase: ReturnType<typeof getServiceSupabase>,
): Promise<number> {
  const { data: byAnilist } = await supabase
    .from('anime_cache')
    .select('anilist_id')
    .eq('anilist_id', id)
    .not('anilist_id', 'is', null)
    .limit(1);
  if (byAnilist?.length) return id;

  const { data: byMal } = await supabase
    .from('anime_cache')
    .select('anilist_id')
    .eq('mal_id', id)
    .not('anilist_id', 'is', null)
    .limit(1);
  if (byMal?.length) return byMal[0].anilist_id as number;

  const { data: byWatchlist } = await supabase
    .from('watchlist_entries')
    .select('canonical_anilist_id')
    .or(`media_id.eq.${id},id_mal.eq.${id}`)
    .not('canonical_anilist_id', 'is', null)
    .limit(1);
  if (byWatchlist?.length) return byWatchlist[0].canonical_anilist_id as number;

  console.warn(
    `[franchise-compute] could not resolve canonical AniList ID for input ${id}, ` +
    `treating as AniList ID directly. This may indicate a wrong-namespace URL upstream.`
  );
  return id;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(payload: Record<string, unknown>) {
        // Silently no-op after client disconnect; server-side traversal continues
        // to completion regardless.
        if (controller.desiredSize === null) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // Stream already closed
        }
      }

      function keepalive() {
        if (controller.desiredSize === null) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // Stream already closed
        }
      }

      const keepaliveInterval = setInterval(keepalive, KEEPALIVE_MS);

      // Close stream on client disconnect so we don't accumulate intervals
      req.signal.addEventListener('abort', () => {
        clearInterval(keepaliveInterval);
        try { controller.close(); } catch { /* already closed */ }
      });

      try {
        const body = await req.json();
        const { anilistId: inputId, force } = body as { anilistId: unknown; force?: boolean };
        if (!inputId || typeof inputId !== 'number') {
          emit({ type: 'error', message: 'Missing or invalid anilistId' });
          return;
        }

        const supabase = getServiceSupabase();
        const anilistId = await resolveCanonicalAnilistId(inputId, supabase);

        // ── Force recompute path ─────────────────────────────────────────
        if (force) {
          const { data: existing } = await supabase
            .from('franchise_watch_orders')
            .select('computed_at, compute_started_at')
            .eq('franchise_root_id', anilistId)
            .limit(1);

          const row = existing?.[0];
          const succeededRecently = row?.computed_at &&
            Date.now() - new Date(row.computed_at as string).getTime() < 5 * 60 * 1000;

          if (succeededRecently) {
            emit({ type: 'error', message: 'Watch order was just rebuilt. Please wait a few minutes before retrying.' });
            return;
          }

          // Clear row and reclaim, then fall through to BFS
          await supabase.from('franchise_watch_orders').upsert({
            franchise_root_id: anilistId,
            ordered_entries: [],
            truncated: false,
            compute_started_at: new Date().toISOString(),
            computed_at: null,
          }, { onConflict: 'franchise_root_id' });
        } else {
          // ── Cache check via franchise_membership (normal path only) ────
          const { data: membership } = await supabase
            .from('franchise_membership')
            .select('franchise_root_id')
            .eq('series_anilist_id', anilistId)
            .limit(1);

          if (membership && membership.length > 0) {
            const rootId = membership[0].franchise_root_id as number;
            const { data: order } = await supabase
              .from('franchise_watch_orders')
              .select('ordered_entries, truncated, computed_at')
              .eq('franchise_root_id', rootId)
              .limit(1);

            if (order && order.length > 0 && order[0].computed_at !== null) {
              emit({
                type: 'result',
                status: 'cached',
                rootId,
                entries: order[0].ordered_entries,
                truncated: order[0].truncated,
              });
              return;
            }
          }
        }

        // ── Claim compute job (skipped for force path — upsert already claimed above) ──
        if (!force) {
          const { error: insertError } = await supabase
            .from('franchise_watch_orders')
            .insert({
              franchise_root_id: anilistId,
              ordered_entries: [],
              truncated: false,
              compute_started_at: new Date().toISOString(),
              computed_at: null,
            });

          if (insertError && insertError.code !== '23505') {
            emit({ type: 'error', message: 'Failed to claim compute job' });
            return;
          }

          if (insertError?.code === '23505') {
            // Conflict — check for abandoned job
            const { data: existing } = await supabase
              .from('franchise_watch_orders')
              .select('compute_started_at, computed_at, ordered_entries, truncated')
              .eq('franchise_root_id', anilistId)
              .limit(1);

            const row = existing?.[0];

            if (row?.computed_at !== null && row?.computed_at !== undefined) {
              // Completed between membership check and now
              emit({
                type: 'result',
                status: 'cached',
                rootId: anilistId,
                entries: row.ordered_entries ?? [],
                truncated: row.truncated ?? false,
              });
              return;
            }

            const startedAt = row?.compute_started_at
              ? new Date(row.compute_started_at as string).getTime()
              : 0;
            const isAbandoned = Date.now() - startedAt > 10 * 60 * 1000;

            if (!isAbandoned) {
              // Another request is actively computing — tell client to wait
              emit({ type: 'error', message: 'Compute already in progress' });
              return;
            }

            // Reclaim abandoned job
            await supabase
              .from('franchise_watch_orders')
              .update({ compute_started_at: new Date().toISOString() })
              .eq('franchise_root_id', anilistId)
              .is('computed_at', null);
          }
        }

        emit({ type: 'start', message: 'Building watch order…' });

        // ── Run BFS traversal ────────────────────────────────────────────
        const result = await computeFranchiseWatchOrder(anilistId, supabase);

        if (result.orderedEntries.length === 0) {
          // Singleton — clean up placeholder row
          await supabase
            .from('franchise_watch_orders')
            .delete()
            .eq('franchise_root_id', anilistId);

          emit({ type: 'result', status: 'singleton', rootId: anilistId, entries: [], truncated: false });
          return;
        }

        const { rootId, orderedEntries, truncated } = result;

        // ── Persist result ───────────────────────────────────────────────
        if (rootId !== anilistId) {
          await supabase.from('franchise_watch_orders').delete().eq('franchise_root_id', anilistId);
          await supabase.from('franchise_watch_orders').upsert({
            franchise_root_id: rootId,
            ordered_entries: orderedEntries,
            truncated,
            compute_started_at: new Date().toISOString(),
            computed_at: new Date().toISOString(),
          }, { onConflict: 'franchise_root_id' });
        } else {
          await supabase
            .from('franchise_watch_orders')
            .update({ ordered_entries: orderedEntries, truncated, computed_at: new Date().toISOString() })
            .eq('franchise_root_id', rootId);
        }

        // ── Write franchise_membership BEFORE emitting result ────────────
        // Prevents race where client receives result, navigates to sibling
        // series, /compute checks membership and misses, starts duplicate traversal.
        const membershipRows = orderedEntries.map((e) => ({
          series_anilist_id: e.anilist_id,
          franchise_root_id: rootId,
        }));
        if (membershipRows.length > 0) {
          await supabase
            .from('franchise_membership')
            .upsert(membershipRows, { onConflict: 'series_anilist_id' });
        }

        // ── Emit result ──────────────────────────────────────────────────
        emit({
          type: 'result',
          status: 'done',
          rootId,
          entries: orderedEntries,   // [{ anilist_id, relation_type }]
          truncated,
        });

        console.log(
          `[franchise/compute] done anilistId=${anilistId} → root=${rootId} ` +
          `entries=${orderedEntries.length} truncated=${truncated}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Traversal failed';
        console.error('[franchise/compute] fatal:', msg);
        emit({ type: 'error', message: msg });
      } finally {
        clearInterval(keepaliveInterval);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
