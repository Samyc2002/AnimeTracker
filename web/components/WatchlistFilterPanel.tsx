'use client';

import { GENRE_MAP } from '@/lib/search/genre-map';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';

const AIRING_OPTIONS = [
  { value: 'RELEASING', label: 'Airing' },
  { value: 'FINISHED', label: 'Finished' },
  { value: 'NOT_YET_RELEASED', label: 'Upcoming' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'HIATUS', label: 'Hiatus' },
] as const;

const GENRE_OPTIONS = GENRE_MAP.map((g) => g.anilist);

interface WatchlistFilterPanelProps {
  airingStatuses: string[];
  genres: string[];
  onAiringChange: (next: string[]) => void;
  onGenreChange: (next: string[]) => void;
  onClear: () => void;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
      {children}
    </h3>
  );
}

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function WatchlistFilterPanel({
  airingStatuses,
  genres,
  onAiringChange,
  onGenreChange,
  onClear,
}: WatchlistFilterPanelProps) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const hasFilters = airingStatuses.length > 0 || genres.length > 0;

  return (
    <div className="bg-[#141925] border border-[#253040] rounded-lg p-4 mb-4">
      <SectionHeader>Airing Status</SectionHeader>
      <div className="flex flex-wrap gap-1.5">
        {AIRING_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onAiringChange(toggle(airingStatuses, opt.value))}
            className={`px-2 py-1 text-xs rounded-md border transition-colors ${
              airingStatuses.includes(opt.value)
                ? `${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`
                : 'bg-[#0b0e14] border-[#253040] text-gray-400 hover:text-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-[#253040]/50">
        <SectionHeader>Genres</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {GENRE_OPTIONS.map((genre) => (
            <button
              key={genre}
              onClick={() => onGenreChange(toggle(genres, genre))}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                genres.includes(genre)
                  ? `${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`
                  : 'bg-[#0b0e14] border-[#253040] text-gray-400 hover:text-gray-200'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center mt-4 pt-3 border-t border-[#253040]">
        <button
          onClick={onClear}
          disabled={!hasFilters}
          className={`px-4 py-1.5 text-xs transition-colors ${
            hasFilters
              ? 'text-gray-400 hover:text-gray-200'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
