const KITSU_BASE = 'https://kitsu.io/api/edge';

function mapStatus(status) {
  switch (status) {
    case 'current': return 'RELEASING';
    case 'finished': return 'FINISHED';
    case 'upcoming':
    case 'unreleased': return 'NOT_YET_RELEASED';
    default: return 'FINISHED';
  }
}

export async function searchKitsu(search) {
  try {
    const res = await fetch(`${KITSU_BASE}/anime?filter[text]=${encodeURIComponent(search)}&page[limit]=10`, {
      headers: { 'Accept': 'application/vnd.api+json' },
    });
    if (!res.ok) throw new Error(`Kitsu error: ${res.status}`);
    const json = await res.json();
    return (json.data || []).map(item => ({
      id: parseInt(item.id, 10),
      idMal: null,
      title: {
        romaji: item.attributes.canonicalTitle || '',
        english: item.attributes.titles?.en || null,
      },
      coverImage: {
        medium: item.attributes.posterImage?.medium || item.attributes.posterImage?.small || '',
      },
      status: mapStatus(item.attributes.status || ''),
      episodes: item.attributes.episodeCount || null,
      nextAiringEpisode: null,
    }));
  } catch (err) {
    throw new Error(`Kitsu search failed: ${err.message}`);
  }
}
