/**
 * Compare fresh airing schedule data against the cached state
 * to find genuinely new episodes.
 *
 * @param {Array} airingSchedules - from AniList AiringSchedule query
 * @param {Object} airingCache - current cached state { [mediaId]: { latestEpisode, airingAt } }
 * @returns {{ newEpisodes: Array, updatedCache: Object }}
 */
export function diffAiring(airingSchedules, airingCache) {
  const newEpisodes = [];
  const updatedCache = { ...airingCache };

  for (const schedule of airingSchedules) {
    const { mediaId, episode, airingAt } = schedule;
    const cached = updatedCache[mediaId];

    if (!cached || episode > cached.latestEpisode) {
      newEpisodes.push({ mediaId, episode, airingAt });
      updatedCache[mediaId] = { latestEpisode: episode, airingAt };
    }
  }

  return { newEpisodes, updatedCache };
}
