'use client';

import { useState, useEffect } from 'react';

interface Props {
  html: string;
  collapseKey: string | number; // changes on navigation, triggering re-collapse
}

export default function SynopsisCollapse({ html, collapseKey }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Re-collapse on navigation (collapseKey changes when anime ID changes)
  useEffect(() => {
    setExpanded(false);
  }, [collapseKey]);

  return (
    <div>
      <div
        className={`text-sm text-gray-300 leading-relaxed overflow-hidden transition-none ${
          expanded ? '' : 'line-clamp-4'
        }`}
        dangerouslySetInnerHTML={{ __html: html.replace(/\n/g, '') }}
      />
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}
