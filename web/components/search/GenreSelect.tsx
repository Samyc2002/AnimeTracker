'use client';

import { useState, useRef, useEffect } from 'react';
import { GENRE_MAP } from '@/lib/search/genre-map';
import type { ProviderName } from '@/lib/search/types';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';

interface GenreSelectProps {
  label: string;
  selected: string[];
  onChange: (next: string[]) => void;
  activeProvider: ProviderName;
  excludeGenres?: string[];
}

export default function GenreSelect({
  label,
  selected,
  onChange,
  activeProvider,
  excludeGenres = [],
}: GenreSelectProps) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function isItemDisabled(anilistName: string): string | null {
    if (activeProvider === 'jikan') {
      const mapping = GENRE_MAP.find((g) => g.anilist === anilistName);
      if (mapping && mapping.malId === null) return 'Not available on Jikan';
    }
    return null;
  }

  function toggle(genre: string) {
    if (selected.includes(genre)) {
      onChange(selected.filter((g) => g !== genre));
    } else {
      onChange([...selected, genre]);
    }
  }

  const available = GENRE_MAP.filter((g) => !excludeGenres.includes(g.anilist));

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((g) => {
            const disabledReason = isItemDisabled(g);
            return (
              <span
                key={g}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border ${
                  disabledReason
                    ? 'opacity-40 border-gray-600 text-gray-500 line-through'
                    : `${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`
                }`}
                title={disabledReason ?? undefined}
              >
                {g}
                <button
                  onClick={() => toggle(g)}
                  className="hover:text-gray-200 text-[10px] leading-none"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-2 py-1 text-xs text-left bg-[#0b0e14] border border-[#253040] rounded-md text-gray-400 hover:text-gray-200"
      >
        {selected.length === 0 ? 'Select genres...' : 'Add more...'}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-[#141925] border border-[#253040] rounded-lg shadow-lg thin-scrollbar">
          {available.map((g) => {
            const isSelected = selected.includes(g.anilist);
            const disabledReason = isItemDisabled(g.anilist);
            return (
              <button
                key={g.anilist}
                onClick={() => { if (!disabledReason) toggle(g.anilist); }}
                disabled={!!disabledReason}
                title={disabledReason ?? undefined}
                className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${
                  disabledReason
                    ? 'opacity-40 cursor-not-allowed text-gray-500'
                    : isSelected
                      ? `${theme.btnText} bg-[#1c2333]`
                      : 'text-gray-300 hover:bg-[#1c2333]'
                }`}
              >
                {g.anilist}
                {isSelected && !disabledReason && <span className="float-right">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
