'use client';

import { useEffect, useState, useCallback } from 'react';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, PLAYLISTS_COLLECTION_ID } from '@/lib/appwrite';
import { searchAnime, fetchAnimeDetail } from '@/lib/anilist';
import Image from 'next/image';
import RequireAuth from '@/components/RequireAuth';
import type { AniListMedia, AnimeDetail } from '@/lib/types';

interface PlaylistDoc {
  $id: string;
  user_id: string;
  title: string;
  description: string;
  anime_ids: string;
  visibility: string;
  slug: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'playlist';
}

export default function PlaylistsPageGuarded() {
  return <RequireAuth><PlaylistsPage /></RequireAuth>;
}

function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<PlaylistDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDoc | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const loadPlaylists = useCallback(async () => {
    try {
      const user = await account.get();
      const res = await databases.listDocuments(DATABASE_ID, PLAYLISTS_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.orderDesc('$createdAt'),
      ]);
      setPlaylists(res.documents as unknown as PlaylistDoc[]);
    } catch {
      // Not authenticated
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  async function createPlaylist() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const user = await account.get();
      const slug = `${slugify(newTitle)}-${Date.now().toString(36)}`;
      await databases.createDocument(DATABASE_ID, PLAYLISTS_COLLECTION_ID, ID.unique(), {
        user_id: user.$id,
        title: newTitle.trim(),
        description: newDescription.trim(),
        anime_ids: '[]',
        visibility: 'public',
        slug,
      });
      setNewTitle('');
      setNewDescription('');
      loadPlaylists();
    } catch {
      // Error creating
    }
    setCreating(false);
  }

  async function deletePlaylist(playlist: PlaylistDoc) {
    await databases.deleteDocument(DATABASE_ID, PLAYLISTS_COLLECTION_ID, playlist.$id);
    setSelectedPlaylist(null);
    loadPlaylists();
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${window.location.origin}/playlists/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  if (loading) {
    return <p className="text-gray-500 text-center mt-12">Loading playlists...</p>;
  }

  if (selectedPlaylist) {
    return (
      <PlaylistEditor
        playlist={selectedPlaylist}
        onBack={() => { setSelectedPlaylist(null); loadPlaylists(); }}
        onDelete={() => deletePlaylist(selectedPlaylist)}
      />
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-200 mb-6">Playlists</h1>

      <div className="bg-[#141925] rounded-lg p-4 mb-6 border border-[#253040]">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Create New Playlist</h2>
        <input
          type="text"
          placeholder="Playlist title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm mb-2 outline-none focus:border-teal-500"
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          className="w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm mb-3 outline-none focus:border-teal-500"
        />
        <button
          onClick={createPlaylist}
          disabled={!newTitle.trim() || creating}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
      </div>

      {playlists.length === 0 ? (
        <p className="text-gray-500 text-center mt-8">No playlists yet. Create one above!</p>
      ) : (
        <div className="space-y-3">
          {playlists.map((pl) => {
            const animeIds: number[] = JSON.parse(pl.anime_ids || '[]');
            return (
              <div
                key={pl.$id}
                className="bg-[#141925] rounded-lg p-4 hover:bg-[#1c2333] transition-colors cursor-pointer border border-[#253040]"
                onClick={() => setSelectedPlaylist(pl)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">{pl.title}</h3>
                    {pl.description && <p className="text-xs text-gray-500 mt-0.5">{pl.description}</p>}
                    <p className="text-xs text-gray-600 mt-1">{animeIds.length} anime</p>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => copyLink(pl.slug)}
                      className="px-3 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      {copiedSlug === pl.slug ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => deletePlaylist(pl)}
                      className="px-3 py-1 text-xs bg-red-600/20 border border-red-500/30 rounded text-red-400 hover:bg-red-600/30 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlaylistEditor({
  playlist,
  onBack,
  onDelete,
}: {
  playlist: PlaylistDoc;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description);
  const [animeIds, setAnimeIds] = useState<number[]>(JSON.parse(playlist.anime_ids || '[]'));
  const [animeDetails, setAnimeDetails] = useState<Map<number, AnimeDetail>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadDetails() {
      const details = new Map<number, AnimeDetail>();
      for (const id of animeIds) {
        try {
          const detail = await fetchAnimeDetail(id);
          details.set(id, detail);
        } catch {
          // Skip failed fetches
        }
      }
      setAnimeDetails(details);
    }
    if (animeIds.length > 0) loadDetails();
  }, [animeIds]);

  async function save() {
    setSaving(true);
    try {
      await databases.updateDocument(DATABASE_ID, PLAYLISTS_COLLECTION_ID, playlist.$id, {
        title: title.trim(),
        description: description.trim(),
        anime_ids: JSON.stringify(animeIds),
      });
    } catch {
      // Error saving
    }
    setSaving(false);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchAnime(searchQuery);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  function addAnime(mediaId: number) {
    if (!animeIds.includes(mediaId)) {
      const updated = [...animeIds, mediaId];
      setAnimeIds(updated);
      databases.updateDocument(DATABASE_ID, PLAYLISTS_COLLECTION_ID, playlist.$id, {
        anime_ids: JSON.stringify(updated),
      });
    }
  }

  function removeAnime(mediaId: number) {
    const updated = animeIds.filter((id) => id !== mediaId);
    setAnimeIds(updated);
    databases.updateDocument(DATABASE_ID, PLAYLISTS_COLLECTION_ID, playlist.$id, {
      anime_ids: JSON.stringify(updated),
    });
  }

  return (
    <div>
      <button onClick={onBack} className="text-teal-400 text-sm mb-4 hover:text-teal-300">
        &larr; Back to playlists
      </button>

      <div className="space-y-4 mb-6">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          className="w-full text-xl font-bold bg-transparent text-gray-200 outline-none border-b border-transparent focus:border-[#253040] pb-1"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={save}
          placeholder="Add a description..."
          className="w-full text-sm bg-transparent text-gray-400 outline-none border-b border-transparent focus:border-[#253040] pb-1"
        />
      </div>

      <div className="flex gap-2 mb-2">
        <button
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/playlists/${playlist.slug}`)}
          className="px-3 py-1.5 text-xs bg-[#141925] border border-[#253040] rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
        >
          Copy Share Link
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-xs bg-red-600/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-600/30 transition-colors"
        >
          Delete Playlist
        </button>
        {saving && <span className="text-xs text-gray-500 self-center">Saving...</span>}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Add Anime</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Search anime to add..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm outline-none focus:border-teal-500"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {searching ? '...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
            {searchResults.map((media) => {
              const inPlaylist = animeIds.includes(media.id);
              const mediaTitle = media.title.english || media.title.romaji;
              return (
                <div key={media.id} className="flex items-center gap-3 bg-[#0b0e14] rounded-lg p-2">
                  <Image
                    src={media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '/icon-128.png'}
                    alt=""
                    width={36}
                    height={50}
                    className="rounded object-cover flex-shrink-0"
                    unoptimized
                  />
                  <span className="text-sm text-gray-300 flex-1 truncate">{mediaTitle}</span>
                  <button
                    onClick={() => addAnime(media.id)}
                    disabled={inPlaylist}
                    className="px-2 py-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {inPlaylist ? 'Added' : '+ Add'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Anime in Playlist ({animeIds.length})
        </h2>

        {animeIds.length === 0 ? (
          <p className="text-gray-600 text-sm">No anime added yet. Use the search above to add some.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {animeIds.map((id) => {
              const detail = animeDetails.get(id);
              const detailTitle = detail ? (detail.title.english || detail.title.romaji) : `Anime #${id}`;
              return (
                <div key={id} className={`bg-[#141925] rounded-lg overflow-hidden group relative ${detail?.isAdult ? 'border border-red-500/40' : ''}`}>
                  <div className="relative w-full aspect-[3/4]">
                    {detail ? (
                      <Image
                        src={detail.coverImage.extraLarge || detail.coverImage.large || detail.coverImage.medium}
                        alt={detailTitle}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[#1e2736] flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-[#253040] border-t-teal-500 rounded-full animate-spin" />
                      </div>
                    )}
                    <button
                      onClick={() => removeAnime(id)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-600/80 hover:bg-red-600 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate" title={detailTitle}>
                      {detailTitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
