'use client';

import Link from 'next/link';

interface EpisodeGridProps {
  totalEpisodes: number;
  watchedEpisodes?: number[];
  onToggle?: (episode: number) => void;
  linkPrefix?: string;
  currentEpisode?: number;
  availableUpTo?: number;
}

export default function EpisodeGrid({
  totalEpisodes,
  watchedEpisodes = [],
  onToggle,
  linkPrefix,
  currentEpisode,
  availableUpTo,
}: EpisodeGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
      {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((ep) => {
        const isWatched = watchedEpisodes.includes(ep);
        const isCurrent = currentEpisode === ep;
        const isAvailable = availableUpTo === undefined || ep <= availableUpTo;

        if (!isAvailable) {
          return (
            <div
              key={ep}
              className="h-9 rounded text-sm font-semibold bg-[#1a1a2e] text-gray-700 flex items-center justify-center cursor-not-allowed border border-[#2a2a4a] border-dashed"
              title={`Episode ${ep} — not yet aired`}
            >
              {ep}
            </div>
          );
        }

        const className = `h-9 rounded text-sm font-semibold transition-colors ${
          isCurrent
            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
            : isWatched
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-[#2a2a4a] text-gray-500 hover:bg-[#3a3a6a]'
        }`;

        if (linkPrefix) {
          return (
            <Link
              key={ep}
              href={`${linkPrefix}/${ep}`}
              className={`${className} flex items-center justify-center`}
            >
              {ep}
            </Link>
          );
        }

        return (
          <button
            key={ep}
            onClick={() => onToggle?.(ep)}
            className={className}
          >
            {ep}
          </button>
        );
      })}
    </div>
  );
}
