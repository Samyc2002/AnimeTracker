'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';

interface AnimeCardProps {
  title: string;
  coverUrl: string;
  status: string;
  episodes?: number | null;
  progress?: string;
  watchedCount?: number;
  totalForProgress?: number;
  airedEpisodes?: number;
  action?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  isAdult?: boolean;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  RELEASING: { label: 'Airing', className: 'bg-emerald-900 text-emerald-300' },
  FINISHED: { label: 'Finished', className: 'bg-blue-900 text-blue-300' },
  NOT_YET_RELEASED: { label: 'Upcoming', className: 'bg-amber-900 text-amber-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-900 text-red-300' },
  HIATUS: { label: 'Hiatus', className: 'bg-gray-700 text-gray-300' },
};

export default function AnimeCard({
  title,
  coverUrl,
  status,
  episodes,
  progress,
  watchedCount,
  totalForProgress,
  airedEpisodes,
  action,
  href,
  onClick,
  isAdult,
}: AnimeCardProps) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const statusInfo = statusLabels[status] || statusLabels.FINISHED;

  const interactive = !!(href || onClick);
  const cls = `group/card flex gap-3 bg-[#141925] rounded-lg p-3 relative ${interactive ? 'cursor-pointer hover:bg-[#1c2333]' : ''} ${isAdult ? 'border border-red-500/40' : ''} transition-colors`;

  const content = (
    <>
      <Image
        src={coverUrl || '/placeholder.png'}
        alt=""
        width={56}
        height={80}
        className="rounded object-cover flex-shrink-0 w-14 h-20"
        sizes="56px"
        unoptimized
      />
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <p className="text-sm font-semibold text-gray-200 truncate">{title}</p>
        <div className="flex items-center gap-2 text-xs">
          <span className={`px-1.5 py-0.5 rounded font-semibold uppercase ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
          {episodes && <span className="text-gray-500">{episodes} eps</span>}
        </div>
        {watchedCount != null && totalForProgress != null && totalForProgress > 0 && (() => {
          const pct = Math.min((watchedCount / totalForProgress) * 100, 100);
          const airedPct = airedEpisodes ? Math.min((airedEpisodes / totalForProgress) * 100, 100) : undefined;
          return (
            <div className="w-full h-1.5 bg-[#1e2736] rounded-full overflow-hidden relative">
              {airedPct != null && airedPct > pct && (
                <div className="absolute inset-y-0 left-0 rounded-full bg-gray-600/40" style={{ width: `${airedPct}%` }} />
              )}
              <div
                className={`h-full rounded-full ${theme.activeTab} transition-all relative z-10`}
                style={{ width: `${pct}%` }}
              />
            </div>
          );
        })()}
        {progress && !watchedCount && <p className={`text-xs ${theme.btnText}`}>{progress}</p>}
      </div>
      {action && <div className="flex items-center flex-shrink-0">{action}</div>}
      {watchedCount != null && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#0b0e14]/90 border border-[#253040] rounded-lg text-xs text-gray-200 whitespace-nowrap opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none z-20">
          {watchedCount > 0
            ? `${watchedCount}/${totalForProgress ?? '?'} episodes watched`
            : 'Not started yet'}
        </div>
      )}
    </>
  );

  if (href) {
    return <Link href={href} onClick={onClick} className={cls}>{content}</Link>;
  }

  return <div onClick={onClick} className={cls}>{content}</div>;
}
