import type { SupabaseClient } from '@supabase/supabase-js';
import type { AniListMedia, AnimeDetail } from '@/lib/types';

interface SeriesMetadataRow {
  anilist_id: number;
  genres: string[] | null;
  tags: { name: string; rank: number }[] | null;
  studio: string | null;
  format: string | null;
  season_year: number | null;
  season: string | null;
  source: string | null;
  episode_count: number | null;
  duration: number | null;
  average_score: number | null;
  popularity: number | null;
  metadata_fetched_at: string;
}

function mediaToMetadataRow(media: AniListMedia | AnimeDetail): SeriesMetadataRow | null {
  if (!media.id) return null;

  const nodes = media.studios?.nodes ?? [];
  const primaryStudio = nodes[0]?.name ?? null;

  return {
    anilist_id: media.id,
    genres: (media.genres && media.genres.length > 0) ? media.genres : null,
    tags: (media.tags && media.tags.length > 0) ? media.tags : null,
    studio: primaryStudio,
    format: media.format ?? null,
    season_year: media.seasonYear ?? null,
    season: media.season ?? null,
    source: media.source ?? null,
    episode_count: media.episodes ?? null,
    duration: media.duration ?? null,
    average_score: media.averageScore ?? null,
    popularity: media.popularity ?? null,
    metadata_fetched_at: new Date().toISOString(),
  };
}

/**
 * Upsert series metadata for a single series.
 * Safe to call from client-side (browser Supabase client) or server-side (service role).
 * No-ops if media has no metadata fields populated (skips rows with all-null metadata).
 */
export async function upsertSeriesMetadata(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  media: AniListMedia | AnimeDetail,
): Promise<void> {
  const row = mediaToMetadataRow(media);
  if (!row) return;
  // Skip if no metadata fields populated — nothing useful to store
  if (!row.genres && !row.studio && !row.format && !row.season_year && !row.average_score) return;

  await supabase
    .from('series_metadata')
    .upsert(row, { onConflict: 'anilist_id' })
    .then(({ error }) => {
      if (error) console.error('[series_metadata] upsert failed:', error.message);
    });
}

/**
 * Batch upsert series metadata for multiple series.
 * Filters out entries with no useful metadata before writing.
 */
export async function upsertSeriesMetadataBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  mediaList: (AniListMedia | AnimeDetail)[],
): Promise<void> {
  const rows = mediaList
    .map(mediaToMetadataRow)
    .filter((r): r is SeriesMetadataRow =>
      r !== null && !!(r.genres || r.studio || r.format || r.season_year || r.average_score)
    );
  if (rows.length === 0) return;

  const { error } = await supabase
    .from('series_metadata')
    .upsert(rows, { onConflict: 'anilist_id' });
  if (error) console.error('[series_metadata] batch upsert failed:', error.message);
}
