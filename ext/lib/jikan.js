const JIKAN_BASE = 'https://api.jikan.moe/v4';
let lastRequestTime = 0;

async function jikanFetch(path) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1000) {
    await new Promise(r => setTimeout(r, 1000 - elapsed));
  }
  lastRequestTime = Date.now();
  const res = await fetch(`${JIKAN_BASE}${path}`);
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 2000));
    return jikanFetch(path);
  }
  if (!res.ok) throw new Error(`Jikan error: ${res.status}`);
  return res.json();
}

function mapStatus(status) {
  switch (status) {
    case 'Currently Airing': return 'RELEASING';
    case 'Finished Airing': return 'FINISHED';
    case 'Not yet aired': return 'NOT_YET_RELEASED';
    default: return 'FINISHED';
  }
}

export async function searchJikan(search) {
  const data = await jikanFetch(`/anime?q=${encodeURIComponent(search)}&limit=10`);
  return (data.data || []).map(item => ({
    id: item.mal_id,
    idMal: item.mal_id,
    title: { romaji: item.title || '', english: item.title_english || null },
    coverImage: { medium: item.images?.jpg?.image_url || '' },
    status: mapStatus(item.status || ''),
    episodes: item.episodes || null,
    nextAiringEpisode: null,
  }));
}

export async function fetchJikanAiring(mediaIds, fromTimestamp, toTimestamp) {
  // Jikan doesn't have a direct "airing schedules for specific IDs" endpoint
  // Fetch the full schedule and filter to our media IDs
  try {
    const data = await jikanFetch('/schedules?limit=25');
    const allItems = data.data || [];
    // Map MAL IDs to airing data
    const results = [];
    for (const item of allItems) {
      if (mediaIds.includes(item.mal_id)) {
        results.push({
          mediaId: item.mal_id,
          episode: item.episodes || 0,
          airingAt: item.broadcast?.time ? computeAiringTimestamp(item.broadcast) : Math.floor(Date.now() / 1000),
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

// Helper to compute airing timestamp from Jikan broadcast data
const DAY_MAP = { 'Sundays': 0, 'Mondays': 1, 'Tuesdays': 2, 'Wednesdays': 3, 'Thursdays': 4, 'Fridays': 5, 'Saturdays': 6 };

function computeAiringTimestamp(broadcast) {
  if (!broadcast?.day || !broadcast?.time) return 0;
  const dayNum = DAY_MAP[broadcast.day];
  if (dayNum === undefined) return 0;
  const [hours, minutes] = broadcast.time.split(':').map(Number);
  const now = new Date();
  const diff = ((dayNum - now.getDay()) + 7) % 7;
  const airDate = new Date(now);
  airDate.setDate(now.getDate() + diff);
  airDate.setHours(hours, minutes, 0, 0);
  // Convert JST to local
  const jstOffset = 9 * 60;
  const localOffset = airDate.getTimezoneOffset();
  airDate.setMinutes(airDate.getMinutes() - jstOffset - localOffset);
  return Math.floor(airDate.getTime() / 1000);
}
