'use client';

import { useEffect } from 'react';

export default function DevtoolsGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;

    function blockDevtoolsKeys(e: KeyboardEvent) {
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && e.key === 'u') {
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
