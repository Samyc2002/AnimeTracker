'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';

interface EpisodeGridProps {
  totalEpisodes: number;
  watchedEpisodes?: number[];
  onToggle?: (episode: number) => void;
  linkPrefix?: string;
  currentEpisode?: number;
  availableUpTo?: number;
}

const BATCH_SIZE = 100;

const themeBtnHex: Record<string, string> = {
  teal: '#0d9488',
  rose: '#e11d48',
};

export default function EpisodeGrid({
  totalEpisodes,
  watchedEpisodes = [],
  onToggle,
  linkPrefix,
  currentEpisode,
  availableUpTo,
}: EpisodeGridProps) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const needsBatching = totalEpisodes > BATCH_SIZE;
  const totalBatches = Math.ceil(totalEpisodes / BATCH_SIZE);
  const [activeBatch, setActiveBatch] = useState(() => {
    if (!needsBatching) return 0;
    const lastWatched = watchedEpisodes.length > 0 ? Math.max(...watchedEpisodes) : 1;
    return Math.floor((lastWatched - 1) / BATCH_SIZE);
  });

  const rangeStart = activeBatch * BATCH_SIZE + 1;
  const rangeEnd = Math.min((activeBatch + 1) * BATCH_SIZE, totalEpisodes);
  const watchedBgColor = themeBtnHex[theme.accent] || '#0d9488';

  return (
    <div>
      {needsBatching && (
        <div className="flex items-center gap-2 mb-3">
          <select
            value={activeBatch}
            onChange={(e) => setActiveBatch(Number(e.target.value))}
            className="bg-[#0b0e14] border border-[#253040] rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
          >
            {Array.from({ length: totalBatches }, (_, i) => {
              const start = i * BATCH_SIZE + 1;
              const end = Math.min((i + 1) * BATCH_SIZE, totalEpisodes);
              const watchedInBatch = watchedEpisodes.filter((e) => e >= start && e <= end).length;
              const total = end - start + 1;
              return (
                <option key={i} value={i}>
                  Episodes {start}-{end} ({watchedInBatch}/{total})
                </option>
              );
            })}
          </select>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
        {Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => rangeStart + i).map((ep) => {
          const isWatched = watchedEpisodes.includes(ep);
          const isCurrent = currentEpisode === ep;
          const isAvailable = availableUpTo === undefined || ep <= availableUpTo;

          if (!isAvailable) {
            return (
              <div
                key={ep}
                className="h-9 rounded text-sm font-semibold bg-[#111827] text-gray-700 flex items-center justify-center cursor-not-allowed border border-[#1e2736] border-dashed"
                title={`Episode ${ep}: not yet aired`}
              >
                {ep}
              </div>
            );
          }

          if (isCurrent) {
            const currentClassName = 'h-9 rounded text-sm font-semibold bg-emerald-600 text-white ring-2 ring-emerald-400';
            if (linkPrefix) {
              return (
                <Link key={ep} href={`${linkPrefix}/${ep}`} className={`${currentClassName} flex items-center justify-center`}>
                  {ep}
                </Link>
              );
            }
            return (
              <motion.button
                key={ep}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                onClick={() => onToggle?.(ep)}
                className={currentClassName}
              >
                {ep}
              </motion.button>
            );
          }

          if (linkPrefix) {
            const className = `h-9 rounded text-sm font-semibold transition-colors ${
              isWatched ? `${theme.btn} text-white` : 'bg-[#1e2736] text-gray-500 hover:bg-[#2a3a4d]'
            }`;
            return (
              <Link key={ep} href={`${linkPrefix}/${ep}`} className={`${className} flex items-center justify-center`}>
                {ep}
              </Link>
            );
          }

          return (
            <motion.button
              key={ep}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.08 }}
              animate={{ backgroundColor: isWatched ? watchedBgColor : '#1e2736' }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              onClick={() => onToggle?.(ep)}
              className={`h-9 rounded text-sm font-semibold ${
                isWatched ? 'text-white' : 'text-gray-500'
              }`}
            >
              {ep}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
