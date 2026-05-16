'use client';

import { useState, useRef, useEffect } from 'react';

interface DisabledFilterProps {
  disabled: boolean;
  reason?: string;
  children: React.ReactNode;
}

export default function DisabledFilter({ disabled, reason, children }: DisabledFilterProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowTooltip(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTooltip]);

  if (!disabled) return <>{children}</>;

  return (
    <div ref={ref} className="relative">
      <div
        className="opacity-40 pointer-events-none select-none"
        aria-disabled="true"
      >
        {children}
      </div>
      <div
        className="absolute inset-0 cursor-not-allowed"
        onClick={() => setShowTooltip(true)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      />
      {showTooltip && reason && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#1e2736] border border-[#253040] rounded-lg text-xs text-gray-300 whitespace-nowrap shadow-lg">
          {reason}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1e2736]" />
        </div>
      )}
    </div>
  );
}
