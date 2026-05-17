'use client';

import { useState, useRef, useEffect } from 'react';
import { SORT_OPTIONS, getEffectiveSort } from '@/lib/search/sort-maps';
import type { SearchFilterState } from '@/lib/search/types';

interface SortDropdownProps {
  filters: SearchFilterState;
  supportedSorts: string[];
  activeProvider: string;
  onSortChange: (sort: string | null) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  anilist: 'AniList',
  jikan: 'Jikan',
  kitsu: 'Kitsu',
  anime_cache: 'Cache',
};

export default function SortDropdown({
  filters,
  supportedSorts,
  activeProvider,
  onSortChange,
}: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const effective = getEffectiveSort(filters);
  const isSupported = supportedSorts.includes(effective);
  const isRelevanceDisabled = !filters.q;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activeLabel = SORT_OPTIONS.find((o) => o.value === effective)?.label ?? effective;
  const isDefault = filters.sort === null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-[#141925] border border-[#253040] rounded-lg text-gray-400 hover:text-gray-200 transition-colors max-w-[200px]"
      >
        <span className="truncate">
          Sort: {activeLabel}
          {isDefault && <span className="text-gray-500 hidden sm:inline"> (default)</span>}
        </span>
        {!isSupported && (
          <>
            <span className="hidden sm:inline text-amber-500 text-[10px] whitespace-nowrap ml-1">(not applied)</span>
            <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 ml-1" title="Sort not applied by current provider" />
          </>
        )}
        <span className="text-[10px] ml-0.5">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-52 bg-[#141925] border border-[#253040] rounded-lg shadow-lg">
          {SORT_OPTIONS.map((opt) => {
            const supported = supportedSorts.includes(opt.value);
            const disabled = !supported || (opt.value === 'relevance' && isRelevanceDisabled);
            const selected = effective === opt.value;
            const notApplied = selected && !supported;

            let tooltip: string | undefined;
            if (opt.value === 'relevance' && isRelevanceDisabled) {
              tooltip = 'Requires a text query';
            } else if (!supported) {
              tooltip = `Not available on ${PROVIDER_LABELS[activeProvider] ?? activeProvider}`;
            }

            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (!disabled) {
                    onSortChange(opt.value);
                    setOpen(false);
                  }
                }}
                disabled={disabled && !notApplied}
                title={tooltip}
                className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between transition-colors ${
                  disabled && !notApplied
                    ? 'opacity-40 cursor-not-allowed text-gray-500'
                    : selected
                      ? 'text-gray-200 bg-[#1c2333]'
                      : 'text-gray-300 hover:bg-[#1c2333]'
                }`}
              >
                <span>{opt.label}</span>
                <span className="flex items-center gap-1">
                  {selected && <span>✓</span>}
                  {notApplied && <span className="text-amber-500 text-[10px]">not applied</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
