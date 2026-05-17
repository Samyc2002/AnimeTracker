'use client';

import { useEffect, useState } from 'react';

const LS_KEY = 'streaming_banner_dismissed';

interface SiteSummary {
  site: string;
  watching: number;
  planned: number;
}

function formatSite(s: SiteSummary): string {
  const parts: string[] = [];
  if (s.watching > 0) parts.push(`${s.watching} watching`);
  if (s.planned > 0) parts.push(`${s.planned} planned`);
  return `${parts.join(', ')} on ${s.site}`;
}

export default function StreamingBanner({ userId }: { userId: string | null }) {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!userId) return;
    if (localStorage.getItem(LS_KEY)) return;
    setDismissed(false);

    fetch('/api/streaming-summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.sites?.length > 0) setSites(data.sites);
      })
      .catch(() => {});
  }, [userId]);

  if (dismissed || sites.length === 0) return null;

  function dismiss() {
    localStorage.setItem(LS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="bg-[#141925] border border-[#253040] rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-500 mt-0.5 flex-shrink-0">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <p className="flex-1 text-sm text-gray-300">
        {sites.map((s, i) => (
          <span key={s.site}>
            {i > 0 && <span className="text-gray-600"> · </span>}
            {s.watching > 0 && <span>{s.watching} watching</span>}
            {s.watching > 0 && s.planned > 0 && ', '}
            {s.planned > 0 && <span>{s.planned} planned</span>}
            {' on '}
            <span className="text-gray-100 font-medium">{s.site}</span>
          </span>
        ))}
      </p>
      <button
        onClick={dismiss}
        className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 mt-0.5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
