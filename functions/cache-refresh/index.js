const { Client, Databases, Query, ID } = require('node-appwrite');

const JIKAN_BASE = 'https://api.jikan.moe/v4';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function jikanFetch(path) {
  const res = await fetch(`${JIKAN_BASE}${path}`);
  if (res.status === 429) {
    await delay(2000);
    return jikanFetch(path);
  }
  if (!res.ok) throw new Error(`Jikan ${res.status}: ${path}`);
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

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function animeToDoc(item) {
  return {
    anilist_id: null,
    mal_id: item.mal_id,
    kitsu_id: null,
    title_romaji: item.title || 'Unknown',
    title_english: item.title_english || null,
    title_native: item.title_japanese || null,
    cover_small: item.images?.jpg?.image_url || null,
    cover_medium: item.images?.jpg?.large_image_url || null,
    cover_large: item.images?.jpg?.large_image_url || null,
    banner_image: null,
    description: item.synopsis || null,
    status: mapStatus(item.status || ''),
    episodes: item.episodes || null,
    duration: parseDuration(item.duration),
    season: item.season || null,
    season_year: item.year || null,
    genres: (item.genres || []).map(g => g.name).join(', ') || null,
    is_adult: typeof item.rating === 'string' && item.rating.includes('Rx'),
    average_score: typeof item.score === 'number' ? Math.round(item.score * 10) : null,
    studio: (item.studios || [])[0]?.name || null,
    next_airing_episode: null,
    next_airing_at: null,
    relations_json: null,
    updated_at: new Date().toISOString(),
  };
}

module.exports = async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const dbId = process.env.DATABASE_ID;
  const cacheCol = process.env.ANIME_CACHE_COLLECTION_ID;

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Fetch top anime (pages 1-8 = 200 anime)
    for (let page = 1; page <= 8; page++) {
      log(`Fetching top anime page ${page}...`);
      try {
        const data = await jikanFetch(`/top/anime?page=${page}&limit=25`);
        for (const item of data.data || []) {
          try {
            const existing = await databases.listDocuments(dbId, cacheCol, [
              Query.equal('mal_id', item.mal_id),
              Query.limit(1),
            ]);

            const doc = animeToDoc(item);

            if (existing.documents.length > 0) {
              await databases.updateDocument(dbId, cacheCol, existing.documents[0].$id, doc);
              skipped++;
            } else {
              await databases.createDocument(dbId, cacheCol, ID.unique(), doc);
              saved++;
            }
          } catch (err) {
            errors++;
          }
        }
        await delay(1000);
      } catch (err) {
        error(`Page ${page} failed: ${err.message}`);
      }
    }

    // Fetch currently airing
    log('Fetching currently airing anime...');
    try {
      const airingData = await jikanFetch('/top/anime?filter=airing&limit=25');
      for (const item of airingData.data || []) {
        try {
          const existing = await databases.listDocuments(dbId, cacheCol, [
            Query.equal('mal_id', item.mal_id),
            Query.limit(1),
          ]);

          const doc = animeToDoc(item);

          if (existing.documents.length > 0) {
            await databases.updateDocument(dbId, cacheCol, existing.documents[0].$id, doc);
          } else {
            await databases.createDocument(dbId, cacheCol, ID.unique(), doc);
            saved++;
          }
        } catch (err) {
          errors++;
        }
      }
    } catch (err) {
      error(`Airing fetch failed: ${err.message}`);
    }

    log(`Done. Saved: ${saved}, Updated: ${skipped}, Errors: ${errors}`);
    return res.json({ saved, skipped, errors });
  } catch (err) {
    error(`Function failed: ${err.message}`);
    return res.json({ error: err.message }, 500);
  }
};
