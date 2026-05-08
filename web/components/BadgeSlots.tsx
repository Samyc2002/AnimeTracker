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
    <div className="flex items-center justify-center gap-2 mt-3">
      {badges.map((badge) => (
        <div key={badge.id} className="group/badge relative">
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-amber-700/30 bg-[#141925]">
            <Image
              src={getBadgeUrl(badge.asset_name)}
              alt={badge.name}
              width={36}
              height={36}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-[#0b0e14] border border-[#253040] rounded-lg opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none z-20 min-w-[140px] text-center">
            <p className="text-xs font-semibold text-amber-300">{badge.name}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{badge.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
