'use client';

import { useEffect, useState } from 'react';

interface ProviderStatus {
  name: string;
  up: boolean;
}

export default function ProviderStatusBanner() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkProviders() {
      const results = await Promise.all([
        checkAniList(),
        checkJikan(),
        checkKitsu(),
      ]);
      setProviders(results);
    }
    checkProviders();
  }, []);

  const downProviders = providers.filter((p) => !p.up);

  if (downProviders.length === 0 || dismissed) return null;

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

async function checkAniList(): Promise<ProviderStatus> {
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ Page(perPage:1) { media(type:ANIME) { id } } }' }),
    });
    return { name: 'AniList', up: res.ok };
  } catch {
    return { name: 'AniList', up: false };
  }
}

async function checkJikan(): Promise<ProviderStatus> {
  try {
    const res = await fetch('https://api.jikan.moe/v4/anime/1');
    const contentType = res.headers.get('content-type') || '';
    return { name: 'Jikan', up: res.ok && contentType.includes('json') };
  } catch {
    return { name: 'Jikan', up: false };
  }
}

async function checkKitsu(): Promise<ProviderStatus> {
  try {
    const res = await fetch('https://kitsu.io/api/edge/anime?page[limit]=1', {
      headers: { 'Accept': 'application/vnd.api+json' },
    });
    const contentType = res.headers.get('content-type') || '';
    return { name: 'Kitsu', up: res.ok && contentType.includes('json') };
  } catch {
    return { name: 'Kitsu', up: false };
  }
}
