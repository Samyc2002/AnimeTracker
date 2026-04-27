import { useEffect } from 'react';

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | Anime Tracker`;
    return () => { document.title = 'Anime Tracker'; };
  }, [title]);
}
