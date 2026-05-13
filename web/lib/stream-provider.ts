import { WatchURLs } from "./types";

export async function getWatchUrl(
  title: string,
  episode: number = 0
): Promise<WatchURLs | null> {
  try {
    const res = await fetch(
      `/api/stream?title=${encodeURIComponent(title)}&episode=${episode}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      url9anime: data.url9anime,
      urlKickass: data.urlKickass,
    };
  } catch {
    return null;
  }
}
