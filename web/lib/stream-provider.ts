export interface SubtitleTrack {
  url: string;
  lang: string;
  label: string;
}

export interface StreamSource {
  url: string;
  quality: string;
  subtitles?: SubtitleTrack[];
}

/**
 * Fetch available stream sources for an anime episode.
 *
 * Implement your stream fetching logic here. Both malId and anilistId
 * are provided since different sources use different ID systems.
 *
 * Return an array of StreamSource objects (one per quality level).
 * Return an empty array if no sources are found.
 */
export async function getEpisodeStream(
  _malId: number | null,
  _anilistId: number,
  _episode: number
): Promise<StreamSource[]> {
  // TODO: Implement your stream source fetching here
  return [];
}
