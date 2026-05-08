'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getBadgeUrl } from '@/lib/achievements/badge-url';

interface Badge {
  id: string;
  name: string;
  description: string;
  asset_name: string;
  is_pinned: boolean;
  unlocked_at: string;
}

export default function BadgeSlots({ username }: { username: string }) {
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    fetch(`/api/achievements/public/${username}`)
      .then((r) => r.ok ? r.json() : { badges: [] })
      .then((d) => setBadges((d.badges || []).slice(0, 3)))
      .catch(() => {});
  }, [username]);

  if (badges.length === 0) return null;

  return (
    <>
      {badges.map((badge) => (
        <div key={badge.id} className="group/badge relative">
          <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-amber-500/60 cursor-default">
            <Image
              src={getBadgeUrl(badge.asset_name)}
              alt={badge.name}
              width={28}
              height={28}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-[#0b0e14] border border-[#253040] rounded-lg opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none z-20 min-w-[120px] text-center">
            <p className="text-[11px] font-semibold text-amber-300">{badge.name}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{badge.description}</p>
          </div>
        </div>
      ))}
    </>
  );
}
