import { WatchURLs } from "./types";

export async function getWatchUrl(title: string): Promise<WatchURLs | null> {
  try {
    const res = await fetch(`/api/stream?title=${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      url9anime: data.url9anime,
      urlAnikoto: data.urlAnikoto,
    };
  } catch {
    return null;
  }
}
