'use client';

import { useEffect, useState } from 'react';

export interface ProviderHealth {
  anilist: boolean;
  jikan: boolean;
  kitsu: boolean;
  checked: boolean;
}

export function useProviderHealth(): ProviderHealth {
  const [health, setHealth] = useState<ProviderHealth>({
    anilist: true,
    jikan: true,
    kitsu: true,
    checked: false,
  });

  useEffect(() => {
    async function check() {
      const [anilist, jikan, kitsu] = await Promise.all([
        fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ Page(perPage:1) { media(type:ANIME) { id } } }' }),
        }).then((r) => r.ok).catch(() => false),

        fetch('https://api.jikan.moe/v4/anime/1')
          .then((r) => r.ok && (r.headers.get('content-type') || '').includes('json'))
          .catch(() => false),

        fetch('https://kitsu.io/api/edge/anime?page[limit]=1', {
          headers: { 'Accept': 'application/vnd.api+json' },
        }).then((r) => r.ok && (r.headers.get('content-type') || '').includes('json'))
          .catch(() => false),
      ]);

      setHealth({ anilist, jikan, kitsu, checked: true });
    }
    check();
  }, []);

  return health;
}
