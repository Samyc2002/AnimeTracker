'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { fetchAnimeDetail } from '@/lib/anilist';
import Footer from '@/components/Footer';
import type { AnimeDetail } from '@/lib/types';

interface PlaylistData {
  title: string;
  description: string;
  anime_ids: number[];
  slug: string;
  created_at: string;
}

export default function PublicPlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [animeList, setAnimeList] = useState<AnimeDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/playlists/${slug}`);
        if (!res.ok) {
          setError(res.status === 404 ? 'Playlist not found' : 'Failed to load playlist');
          setLoading(false);
          return;
        }
        const data: PlaylistData = await res.json();
        setPlaylist(data);

        const details: AnimeDetail[] = [];
        for (const id of data.anime_ids) {
          try {
            const detail = await fetchAnimeDetail(id);
            details.push(detail);
          } catch {
            // Skip failed fetches
          }
        }
        setAnimeList(details);
      } catch {
        setError('Failed to load playlist');
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#253040] border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">{error || 'Playlist not found'}</p>
        <Link href="/login" className="text-teal-400 text-sm hover:text-teal-300">
          Sign in to create your own playlists
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e14]">
      <nav className="bg-[#141925]/60 backdrop-blur-xl border-b border-white/5 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="text-lg font-bold text-teal-400">
          Anime Tracker
        </Link>
        <Link
          href="/login"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Sign in
        </Link>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-100 mb-2">{playlist.title}</h1>
          {playlist.description && (
            <p className="text-sm text-gray-400">{playlist.description}</p>
          )}
          <p className="text-xs text-gray-600 mt-2">{playlist.anime_ids.length} anime</p>
        </div>

        {animeList.length === 0 ? (
          <p className="text-gray-500 text-center mt-12">This playlist is empty.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {animeList.map((anime) => {
              const title = anime.title.english || anime.title.romaji;
              return (
                <div
                  key={anime.id}
                  className={`bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors ${anime.isAdult ? 'border border-red-500/40' : ''}`}
                  onClick={() => router.push(`/anime/${anime.id}`)}
                >
                  <div className="relative w-full aspect-[3/4]">
                    <Image
                      src={anime.coverImage.extraLarge || anime.coverImage.large || anime.coverImage.medium}
                      alt={title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate" title={title}>
                      {title}
                    </p>
                    {anime.averageScore && (
                      <p className="text-[10px] text-yellow-400 mt-0.5">
                        ★ {(anime.averageScore / 10).toFixed(1)}
                      </p>
                    )}
                    {anime.episodes && (
                      <p className="text-[10px] text-gray-500">{anime.episodes} eps</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
