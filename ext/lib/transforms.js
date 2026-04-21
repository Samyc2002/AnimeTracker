export function appwriteToExtension(doc, watchedEpisodeDocs) {
  const episodes = watchedEpisodeDocs
    .map((d) => d.episode_number)
    .sort((a, b) => a - b);

  return {
    mediaId: doc.media_id,
    idMal: doc.id_mal,
    title: {
      romaji: doc.title_romaji,
      english: doc.title_english,
    },
    coverUrl: doc.cover_url,
    status: doc.status,
    totalEpisodes: doc.total_episodes,
    nextAiringEpisode:
      doc.next_airing_episode != null
        ? { episode: doc.next_airing_episode, airingAt: doc.next_airing_at }
        : null,
    episodesWatched: episodes,
    addedAt: doc.$createdAt ? Math.floor(new Date(doc.$createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
    _docId: doc.$id,
  };
}

export function extensionToAppwrite(entry) {
  return {
    media_id: entry.mediaId,
    id_mal: entry.idMal ?? null,
    title_romaji: entry.title?.romaji ?? null,
    title_english: entry.title?.english ?? null,
    cover_url: entry.coverUrl,
    status: entry.status,
    total_episodes: entry.totalEpisodes ?? null,
    next_airing_episode: entry.nextAiringEpisode?.episode ?? null,
    next_airing_at: entry.nextAiringEpisode?.airingAt ?? null,
  };
}
