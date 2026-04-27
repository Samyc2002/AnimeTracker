'use client';

import { useEffect, useState } from 'react';

export default function DevtoolsGuard() {
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;

    const threshold = 160;

    function check() {
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      setDevtoolsOpen(widthDiff || heightDiff);
    }

    check();
    const interval = setInterval(check, 500);
    window.addEventListener('resize', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', check);
    };
  }, []);

  if (!devtoolsOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0b0e14] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-100 mb-3">Developer Tools Detected</h2>
        <p className="text-sm text-gray-400 mb-6">
          Please close Developer Tools to continue using Anime Tracker.
        </p>
      </div>
    </div>
  );
}
