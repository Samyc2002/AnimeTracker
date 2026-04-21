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

export async function getEpisodeStream(
  malId: number | null,
  anilistId: number,
  episode: number
): Promise<StreamSource[]> {
  const params = new URLSearchParams({
    anilistId: String(anilistId),
    episode: String(episode),
  });
  if (malId) params.set('malId', String(malId));

  try {
    const res = await fetch(`/api/stream?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.sources || [];
  } catch {
    return [];
  }
}
