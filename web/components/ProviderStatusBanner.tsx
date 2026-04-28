'use client';

import { useEffect, useState } from 'react';

export default function ProviderStatusBanner() {
  const [anilistDown, setAnilistDown] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkAnilist() {
      try {
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ Page(perPage:1) { media(type:ANIME) { id } } }' }),
        });
        setAnilistDown(!res.ok);
      } catch {
        setAnilistDown(true);
      }
    }
    checkAnilist();
  }, []);

  if (!anilistDown || dismissed) return null;

  return (
    <div className="bg-amber-900/30 border-b border-amber-500/30 px-4 py-2 flex items-center justify-center gap-3">
      <p className="text-xs text-amber-300">
        AniList is currently experiencing issues. Some content may be limited as a backup provider is being used.
      </p>
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
