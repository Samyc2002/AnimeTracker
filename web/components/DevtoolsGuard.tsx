'use client';

import { useEffect } from 'react';

export default function DevtoolsGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;

    function blockDevtoolsKeys(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      if (mod && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        return;
      }
      if (mod && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
      }
    }

    document.addEventListener('keydown', blockDevtoolsKeys);
    return () => {
      document.removeEventListener('keydown', blockDevtoolsKeys);
    };
  }, []);

  return null;
}
