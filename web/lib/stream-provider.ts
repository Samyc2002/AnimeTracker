export async function getWatchUrl(title: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/stream?title=${encodeURIComponent(title)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}
