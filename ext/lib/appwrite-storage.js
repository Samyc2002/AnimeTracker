import { listDocuments, createDocument, deleteDocument, updateDocument } from './appwrite-client.js';
import { DATABASE_ID, WATCHLIST_COLLECTION_ID, WATCHED_EPISODES_COLLECTION_ID, PROFILES_COLLECTION_ID } from './config.js';
import { appwriteToExtension, extensionToAppwrite } from './transforms.js';

function q(field, value) {
  return JSON.stringify({ method: 'equal', attribute: field, values: [value] });
}

function orderDesc(field) {
  return JSON.stringify({ method: 'orderDesc', attribute: field });
}

function limit(n) {
  return JSON.stringify({ method: 'limit', values: [n] });
}

export async function getWatchlistFromAppwrite(auth) {
  const [watchlistRes, watchedRes] = await Promise.all([
    listDocuments(auth.jwt, DATABASE_ID, WATCHLIST_COLLECTION_ID, [
      q('user_id', auth.userId),
      orderDesc('$createdAt'),
      limit(500),
    ]),
    listDocuments(auth.jwt, DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, [
      q('user_id', auth.userId),
      limit(5000),
    ]),
  ]);

  const watchedByMedia = {};
  for (const doc of watchedRes.documents) {
    const mid = doc.media_id;
    if (!watchedByMedia[mid]) watchedByMedia[mid] = [];
    watchedByMedia[mid].push(doc);
  }

  const watchlist = {};
  for (const doc of watchlistRes.documents) {
    const entry = appwriteToExtension(doc, watchedByMedia[doc.media_id] || []);
    watchlist[entry.mediaId] = entry;
  }
  return watchlist;
}

export async function addToWatchlistAppwrite(auth, entry) {
  const data = extensionToAppwrite(entry);
  data.user_id = auth.userId;
  await createDocument(auth.jwt, DATABASE_ID, WATCHLIST_COLLECTION_ID, data);
}

export async function removeFromWatchlistAppwrite(auth, mediaId) {
  const res = await listDocuments(auth.jwt, DATABASE_ID, WATCHLIST_COLLECTION_ID, [
    q('user_id', auth.userId),
    q('media_id', mediaId),
    limit(1),
  ]);
  if (res.documents.length > 0) {
    await deleteDocument(auth.jwt, DATABASE_ID, WATCHLIST_COLLECTION_ID, res.documents[0].$id);
  }

  const watchedRes = await listDocuments(auth.jwt, DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, [
    q('user_id', auth.userId),
    q('media_id', mediaId),
    limit(5000),
  ]);
  await Promise.all(
    watchedRes.documents.map((d) =>
      deleteDocument(auth.jwt, DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, d.$id)
    )
  );
}

export async function toggleEpisodeWatchedAppwrite(auth, mediaId, episodeNum) {
  const res = await listDocuments(auth.jwt, DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, [
    q('user_id', auth.userId),
    q('media_id', mediaId),
    limit(5000),
  ]);

  const existing = res.documents.find((d) => d.episode_number === episodeNum);

  if (existing) {
    await deleteDocument(auth.jwt, DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, existing.$id);
  } else {
    await createDocument(auth.jwt, DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, {
      user_id: auth.userId,
      media_id: mediaId,
      episode_number: episodeNum,
    });
  }

  const updated = await listDocuments(auth.jwt, DATABASE_ID, WATCHED_EPISODES_COLLECTION_ID, [
    q('user_id', auth.userId),
    q('media_id', mediaId),
    limit(5000),
  ]);
  return updated.documents.map((d) => d.episode_number).sort((a, b) => a - b);
}

export async function getSettingsFromAppwrite(auth) {
  const res = await listDocuments(auth.jwt, DATABASE_ID, PROFILES_COLLECTION_ID, [
    q('user_id', auth.userId),
    limit(1),
  ]);

  const localSettings = await chrome.storage.local.get(['settings']);
  const local = localSettings.settings || { pollIntervalMinutes: 30, notificationsEnabled: true, displayLanguage: 'english' };

  if (res.documents.length > 0) {
    local.displayLanguage = res.documents[0].display_language;
    local._profileDocId = res.documents[0].$id;
  }
  return local;
}

export async function updateSettingsAppwrite(auth, updates) {
  if (updates.displayLanguage) {
    const res = await listDocuments(auth.jwt, DATABASE_ID, PROFILES_COLLECTION_ID, [
      q('user_id', auth.userId),
      limit(1),
    ]);

    if (res.documents.length > 0) {
      await updateDocument(auth.jwt, DATABASE_ID, PROFILES_COLLECTION_ID, res.documents[0].$id, {
        display_language: updates.displayLanguage,
      });
    } else {
      await createDocument(auth.jwt, DATABASE_ID, PROFILES_COLLECTION_ID, {
        user_id: auth.userId,
        display_language: updates.displayLanguage,
      });
    }
  }
}
