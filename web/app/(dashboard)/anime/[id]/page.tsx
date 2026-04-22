'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, WATCHLIST_COLLECTION_ID } from '@/lib/appwrite';
import { fetchAnimeDetail, mediaToWatchlistEntry } from '@/lib/anilist';
import type { AnimeDetail } from '@/lib/types';

const statusLabels: Record<string, { label: string; className: string }> = {
  RELEASING: { label: 'Airing', className: 'bg-emerald-900 text-emerald-300' },
  FINISHED: { label: 'Finished', className: 'bg-blue-900 text-blue-300' },
  NOT_YET_RELEASED: { label: 'Upcoming', className: 'bg-amber-900 text-amber-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-900 text-red-300' },
  HIATUS: { label: 'Hiatus', className: 'bg-gray-700 text-gray-300' },
};

const relationOrder = ['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'PARENT', 'SPIN_OFF', 'ALTERNATIVE', 'OTHER'];

function formatCountdown(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function formatRelation(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function AnimeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [adding, setAdding] = useState(false);

  const id = Number(params.id);

  useEffect(() => {
    async function load() {
      try {
        const [detail, user] = await Promise.all([
          fetchAnimeDetail(id),
          account.get(),
        ]);
        setAnime(detail);

        const existing = await databases.listDocuments(DATABASE_ID, WATCHLIST_COLLECTION_ID, [
          Query.equal('user_id', user.$id),
          Query.equal('media_id', id),
          Query.limit(1),
        ]);
        setInWatchlist(existing.documents.length > 0);
      } catch {
        setAnime(null);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleAdd() {
    if (!anime || adding) return;
    setAdding(true);
    try {
      const user = await account.get();
      const entry = mediaToWatchlistEntry({
        id: anime.id,
        idMal: anime.idMal,
        title: { romaji: anime.title.romaji, english: anime.title.english },
        coverImage: anime.coverImage,
        status: anime.status,
        episodes: anime.episodes,
        nextAiringEpisode: anime.nextAiringEpisode,
      });
      await databases.createDocument(DATABASE_ID, WATCHLIST_COLLECTION_ID, ID.unique(), {
        ...entry,
        user_id: user.$id,
      });
      setInWatchlist(true);
    } catch {
      // Failed to add
    }
    setAdding(false);
  }

  useEffect(() => {
    const layoutEl = document.querySelector('[data-dashboard-layout]') as HTMLElement | null;
    if (layoutEl) layoutEl.style.background = 'transparent';
    return () => {
      if (layoutEl) layoutEl.style.background = '';
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center mt-12">
        <div className="w-6 h-6 border-2 border-[#253040] border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!anime) {
    return <p className="text-gray-500 text-center mt-12">Anime not found.</p>;
  }

  const title = anime.title.english || anime.title.romaji;
  const statusInfo = statusLabels[anime.status] || statusLabels.FINISHED;
  const studio = anime.studios.nodes[0]?.name;

  const animeRelations = anime.relations.edges
    .filter((e) => e.node.type === 'ANIME')
    .sort((a, b) => relationOrder.indexOf(a.relationType) - relationOrder.indexOf(b.relationType));

  const backdropImage = anime.bannerImage || anime.coverImage.large || anime.coverImage.medium;

  return (
    <div className="-mx-6 -mt-8 relative min-h-screen">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backdropImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-3xl scale-110 opacity-15"
        />
        <div className="absolute inset-0 bg-[#0b0e14]/80" />
      </div>

      {anime.bannerImage && (
        <div className="relative w-full h-48 md:h-56">
          <Image
            src={anime.bannerImage}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] to-transparent" />
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6">
        <div className={`flex gap-6 ${anime.bannerImage ? '-mt-20 relative z-10' : 'mt-8'}`}>
          <div className="flex-shrink-0">
            <Image
              src={anime.coverImage.large || anime.coverImage.medium}
              alt={title}
              width={160}
              height={230}
              className="rounded-lg shadow-lg object-cover"
              unoptimized
            />
          </div>

          <div className="flex-1 min-w-0 pt-4">
            <h1 className="text-2xl font-bold text-gray-100 mb-1">{title}</h1>
            {anime.title.native && (
              <p className="text-sm text-gray-500 mb-3">{anime.title.native}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
              {anime.averageScore && (
                <span className="text-sm text-yellow-400 font-semibold">
                  ★ {(anime.averageScore / 10).toFixed(1)}
                </span>
              )}
              {studio && <span className="text-sm text-gray-400">{studio}</span>}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-400 mb-4">
              {anime.episodes && <span>{anime.episodes} episodes</span>}
              {anime.duration && <span>{anime.duration} min/ep</span>}
              {anime.season && anime.seasonYear && (
                <span>{anime.season.charAt(0) + anime.season.slice(1).toLowerCase()} {anime.seasonYear}</span>
              )}
            </div>

            <button
              onClick={handleAdd}
              disabled={inWatchlist || adding}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {inWatchlist ? 'In Watchlist' : adding ? 'Adding...' : '+ Add to Watchlist'}
            </button>
          </div>
        </div>

        {anime.nextAiringEpisode && (
          <div className="mt-6 bg-[#141925] rounded-lg p-4 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-gray-300">
              Episode {anime.nextAiringEpisode.episode} airing in{' '}
              <span className="text-teal-400 font-semibold">
                {formatCountdown(anime.nextAiringEpisode.timeUntilAiring)}
              </span>
            </span>
          </div>
        )}

        {anime.genres.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {anime.genres.map((g) => (
              <span key={g} className="px-3 py-1 bg-[#111827] border border-[#253040] rounded-full text-xs text-gray-300">
                {g}
              </span>
            ))}
          </div>
        )}

        {anime.description && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Synopsis</h2>
            <p
              className="text-sm text-gray-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: anime.description.replace(/\n/g, '') }}
            />
          </div>
        )}

        {animeRelations.length > 0 && (
          <div className="mt-8 mb-8">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Related Anime</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {animeRelations.map((edge) => {
                const rel = edge.node;
                const relTitle = rel.title.english || rel.title.romaji;
                return (
                  <div
                    key={rel.id}
                    className="bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors"
                    onClick={() => router.push(`/anime/${rel.id}`)}
                  >
                    <div className="relative w-full aspect-[3/4]">
                      <Image
                        src={rel.coverImage?.medium || '/icon-128.png'}
                        alt={relTitle}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute top-1 left-1">
                        <span className="px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-gray-300 font-medium">
                          {formatRelation(edge.relationType)}
                        </span>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-gray-200 truncate" title={relTitle}>
                        {relTitle}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
