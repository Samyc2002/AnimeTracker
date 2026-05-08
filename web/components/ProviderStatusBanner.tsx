'use client';

import { useState } from 'react';
import { useProviderHealth } from '@/lib/provider-status';

export default function ProviderStatusBanner() {
  const health = useProviderHealth();
  const [dismissed, setDismissed] = useState(false);

  if (!health.checked || dismissed) return null;

  const providers = [
    { name: 'AniList', up: health.anilist },
    { name: 'Jikan', up: health.jikan },
    { name: 'Kitsu', up: health.kitsu },
  ];

  const downProviders = providers.filter((p) => !p.up);
  if (downProviders.length === 0) return null;

  const allDown = downProviders.length === providers.length;
  const names = downProviders.map((p) => p.name).join(', ');

  return (
    <div className="bg-amber-900/30 border-b border-amber-500/30 px-4 py-2 flex items-center justify-center gap-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {providers.map((p) => (
            <span
              key={p.name}
              className={`w-2 h-2 rounded-full ${p.up ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`}
              title={`${p.name}: ${p.up ? 'Online' : 'Down'}`}
            />
          ))}
        </div>
        <p className="text-xs text-amber-300">
          {allDown
            ? 'All anime providers are currently down. Content may be unavailable.'
            : `${names} ${downProviders.length === 1 ? 'is' : 'are'} currently experiencing issues. Backup providers are being used.`}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-200 flex-shrink-0 cursor-pointer"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
