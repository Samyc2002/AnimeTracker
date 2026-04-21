'use client';

import Image from 'next/image';

interface AnimeCardProps {
  title: string;
  coverUrl: string;
  status: string;
  episodes?: number | null;
  progress?: string;
  action?: React.ReactNode;
  onClick?: () => void;
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
  action,
  onClick,
}: AnimeCardProps) {
  const statusInfo = statusLabels[status] || statusLabels.FINISHED;

  return (
    <div
      className={`flex gap-3 bg-[#16213e] rounded-lg p-3 ${onClick ? 'cursor-pointer hover:bg-[#1e2d4d]' : ''} transition-colors`}
      onClick={onClick}
    >
      <Image
        src={coverUrl || '/icon-128.png'}
        alt=""
        width={56}
        height={80}
        className="rounded object-cover flex-shrink-0"
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
        {progress && <p className="text-xs text-purple-400">{progress}</p>}
      </div>
      {action && <div className="flex items-center flex-shrink-0">{action}</div>}
    </div>
  );
}
