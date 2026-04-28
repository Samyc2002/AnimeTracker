'use client';

import { useEffect, useState } from 'react';

export default function ProviderStatusBanner() {
  const [anilistDown, setAnilistDown] = useState(false);

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

  if (!anilistDown) return null;

  return (
    <div className="bg-amber-900/30 border-b border-amber-500/30 px-4 py-2 text-center">
      <p className="text-xs text-amber-300">
        AniList is currently experiencing issues. Some content may be limited as a backup provider is being used.
      </p>
    </div>
  );
}
