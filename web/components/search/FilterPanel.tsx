'use client';

import {
  type SearchFilterState,
  FORMAT_OPTIONS,
  STATUS_OPTIONS,
  SOURCE_OPTIONS,
  SOURCE_LABELS,
  SEASON_OPTIONS,
  COUNTRY_OPTIONS,
  filtersChanged,
} from '@/lib/search/types';
import type { ProviderName, ProviderCapabilities } from '@/lib/search/types';
import DisabledFilter from '@/components/search/DisabledFilter';
import GenreSelect from '@/components/search/GenreSelect';
import TagSelect from '@/components/search/TagSelect';
import StudioSelect from '@/components/search/StudioSelect';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';

const STATUS_LABELS: Record<string, string> = {
  FINISHED: 'Finished',
  RELEASING: 'Releasing',
  NOT_YET_RELEASED: 'Not Yet Released',
  CANCELLED: 'Cancelled',
};

const WATCH_STATUS_OPTIONS = ['Watching', 'Planned', 'Completed', 'Dropped'] as const;

interface FilterPanelProps {
  pending: SearchFilterState;
  applied: SearchFilterState;
  activeProvider: ProviderName;
  capabilities: ProviderCapabilities;
  onPendingChange: (next: SearchFilterState) => void;
  onApply: () => void;
  onClear: () => void;
  watchlistEmpty: boolean;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
      {children}
    </h3>
  );
}

export default function FilterPanel({
  pending,
  applied,
  activeProvider,
  capabilities,
  onPendingChange,
  onApply,
  onClear,
  watchlistEmpty,
}: FilterPanelProps) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const canApply = filtersChanged(pending, applied);

  function toggleWatchlistStatus(value: string) {
    const arr = pending.excludeWatchlistStatuses;
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    onPendingChange({ ...pending, excludeWatchlistStatuses: next });
  }

  function toggleArrayValue(field: 'format' | 'status' | 'source', value: string) {
    const arr = pending[field];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    onPendingChange({ ...pending, [field]: next });
  }

  function disabledReason(field: keyof ProviderCapabilities): string | undefined {
    if (capabilities[field]) return undefined;
    return `Not supported by ${activeProvider}`;
  }

  return (
    <div className="bg-[#141925] border border-[#253040] rounded-lg p-4 mb-4">
      {/* Section 1: Basic */}
      <SectionHeader>Basic</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Format */}
        <DisabledFilter disabled={!capabilities.format} reason={disabledReason('format')}>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Format</label>
            <div className="flex flex-wrap gap-1.5">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => toggleArrayValue('format', f)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    pending.format.includes(f)
                      ? `${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`
                      : 'bg-[#0b0e14] border-[#253040] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </DisabledFilter>

        {/* Status */}
        <DisabledFilter disabled={!capabilities.status} reason={disabledReason('status')}>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleArrayValue('status', s)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    pending.status.includes(s)
                      ? `${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`
                      : 'bg-[#0b0e14] border-[#253040] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {STATUS_LABELS[s] || s}
                </button>
              ))}
            </div>
          </div>
        </DisabledFilter>

        {/* Year Range */}
        <DisabledFilter disabled={!capabilities.yearMin} reason={disabledReason('yearMin')}>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Year Range</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="From"
                value={pending.yearMin ?? ''}
                onChange={(e) =>
                  onPendingChange({
                    ...pending,
                    yearMin: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
              />
              <span className="text-gray-500 text-xs">&ndash;</span>
              <input
                type="number"
                placeholder="To"
                value={pending.yearMax ?? ''}
                onChange={(e) =>
                  onPendingChange({
                    ...pending,
                    yearMax: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
              />
            </div>
          </div>
        </DisabledFilter>

        {/* Adult Content Toggle */}
        <DisabledFilter disabled={!capabilities.isAdult} reason={disabledReason('isAdult')}>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Content</label>
            <button
              onClick={() => onPendingChange({ ...pending, isAdult: !pending.isAdult })}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                pending.isAdult
                  ? 'bg-red-900/40 border-red-500/40 text-red-300'
                  : 'bg-[#0b0e14] border-[#253040] text-gray-400 hover:text-gray-200'
              }`}
            >
              {pending.isAdult ? 'Adult: On' : 'Adult: Off'}
            </button>
          </div>
        </DisabledFilter>
      </div>

      {/* Section 2: Content */}
      <div className="mt-4 pt-3 border-t border-[#253040]/50">
        <SectionHeader>Content</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Genres Include */}
          <DisabledFilter disabled={!capabilities.genres} reason={disabledReason('genres')}>
            <GenreSelect
              label="Genres (Include)"
              selected={pending.genres}
              onChange={(next) => onPendingChange({ ...pending, genres: next })}
              activeProvider={activeProvider}
              excludeGenres={pending.excludedGenres}
            />
          </DisabledFilter>

          {/* Genres Exclude */}
          <DisabledFilter disabled={!capabilities.excludedGenres} reason={disabledReason('excludedGenres')}>
            <GenreSelect
              label="Genres (Exclude)"
              selected={pending.excludedGenres}
              onChange={(next) => onPendingChange({ ...pending, excludedGenres: next })}
              activeProvider={activeProvider}
              excludeGenres={pending.genres}
            />
          </DisabledFilter>

          {/* Tags Include */}
          <DisabledFilter disabled={!capabilities.tags} reason={disabledReason('tags')}>
            <TagSelect
              label="Tags (Include)"
              selected={pending.tags}
              onChange={(next) => onPendingChange({ ...pending, tags: next })}
              excludeTags={pending.excludedTags}
            />
          </DisabledFilter>

          {/* Tags Exclude */}
          <DisabledFilter disabled={!capabilities.excludedTags} reason={disabledReason('excludedTags')}>
            <TagSelect
              label="Tags (Exclude)"
              selected={pending.excludedTags}
              onChange={(next) => onPendingChange({ ...pending, excludedTags: next })}
              excludeTags={pending.tags}
            />
          </DisabledFilter>

          {/* Min Tag Rank */}
          <DisabledFilter disabled={!capabilities.minTagRank} reason={disabledReason('minTagRank')}>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Min Tag Rank: {pending.minTagRank}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={pending.minTagRank}
                onChange={(e) =>
                  onPendingChange({ ...pending, minTagRank: parseInt(e.target.value, 10) })
                }
                className="w-full accent-teal-500"
              />
            </div>
          </DisabledFilter>

          {/* Season + Year */}
          <DisabledFilter disabled={!capabilities.season} reason={disabledReason('season')}>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Season</label>
              <div className="flex items-center gap-2">
                <select
                  value={pending.season ?? ''}
                  onChange={(e) =>
                    onPendingChange({ ...pending, season: e.target.value || null })
                  }
                  className="flex-1 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
                >
                  <option value="">Any</option>
                  {SEASON_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Year"
                  value={pending.seasonYear ?? ''}
                  onChange={(e) =>
                    onPendingChange({
                      ...pending,
                      seasonYear: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
                />
              </div>
            </div>
          </DisabledFilter>
        </div>
      </div>

      {/* Section 3: Score & Stats */}
      <div className="mt-4 pt-3 border-t border-[#253040]/50">
        <SectionHeader>Score & Stats</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Score Range */}
          <DisabledFilter disabled={!capabilities.scoreMin} reason={disabledReason('scoreMin')}>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Score Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="0"
                  min={0}
                  max={10}
                  step={0.5}
                  value={pending.scoreMin ?? ''}
                  onChange={(e) =>
                    onPendingChange({
                      ...pending,
                      scoreMin: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
                />
                <span className="text-gray-500 text-xs">&ndash;</span>
                <input
                  type="number"
                  placeholder="10"
                  min={0}
                  max={10}
                  step={0.5}
                  value={pending.scoreMax ?? ''}
                  onChange={(e) =>
                    onPendingChange({
                      ...pending,
                      scoreMax: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
                />
              </div>
            </div>
          </DisabledFilter>

          {/* Episodes Range */}
          <DisabledFilter disabled={!capabilities.episodesMin} reason={disabledReason('episodesMin')}>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Episodes</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  value={pending.episodesMin ?? ''}
                  onChange={(e) =>
                    onPendingChange({
                      ...pending,
                      episodesMin: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
                />
                <span className="text-gray-500 text-xs">&ndash;</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  value={pending.episodesMax ?? ''}
                  onChange={(e) =>
                    onPendingChange({
                      ...pending,
                      episodesMax: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
                />
              </div>
            </div>
          </DisabledFilter>

          {/* Duration Range */}
          <DisabledFilter disabled={!capabilities.durationMin} reason={disabledReason('durationMin')}>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Duration (min)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  value={pending.durationMin ?? ''}
                  onChange={(e) =>
                    onPendingChange({
                      ...pending,
                      durationMin: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
                />
                <span className="text-gray-500 text-xs">&ndash;</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  value={pending.durationMax ?? ''}
                  onChange={(e) =>
                    onPendingChange({
                      ...pending,
                      durationMax: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
                />
              </div>
            </div>
          </DisabledFilter>
        </div>
      </div>

      {/* Section 4: Production */}
      <div className="mt-4 pt-3 border-t border-[#253040]/50">
        <SectionHeader>Production</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Source */}
          <DisabledFilter disabled={!capabilities.source} reason={disabledReason('source')}>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Source</label>
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleArrayValue('source', s)}
                    className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                      pending.source.includes(s)
                        ? `${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`
                        : 'bg-[#0b0e14] border-[#253040] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {SOURCE_LABELS[s] || s}
                  </button>
                ))}
              </div>
            </div>
          </DisabledFilter>

          {/* Country of Origin */}
          <DisabledFilter disabled={!capabilities.countryOfOrigin} reason={disabledReason('countryOfOrigin')}>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Country</label>
              <select
                value={pending.countryOfOrigin ?? ''}
                onChange={(e) =>
                  onPendingChange({ ...pending, countryOfOrigin: e.target.value || null })
                }
                className="w-full px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
              >
                <option value="">Any</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </DisabledFilter>

          {/* Studios */}
          <DisabledFilter disabled={!capabilities.studios} reason={disabledReason('studios')}>
            <StudioSelect
              selected={pending.studios}
              onChange={(next) => onPendingChange({ ...pending, studios: next })}
            />
          </DisabledFilter>
        </div>
      </div>

      {/* Section 5: My Watchlist */}
      <div className="mt-4 pt-3 border-t border-[#253040]/50">
        <SectionHeader>My Watchlist</SectionHeader>
        <DisabledFilter disabled={watchlistEmpty} reason={watchlistEmpty ? 'Your watchlist is empty' : undefined}>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Exclude by status</label>
            <div className="flex flex-wrap gap-1.5">
              {WATCH_STATUS_OPTIONS.map((ws) => (
                <button
                  key={ws}
                  onClick={() => toggleWatchlistStatus(ws)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    pending.excludeWatchlistStatuses.includes(ws)
                      ? `${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`
                      : 'bg-[#0b0e14] border-[#253040] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {ws}
                </button>
              ))}
            </div>
          </div>
        </DisabledFilter>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#253040]">
        <button
          onClick={onApply}
          disabled={!canApply}
          className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            canApply
              ? `${theme.btn} text-white`
              : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
          }`}
        >
          Apply Filters
        </button>
        <button
          onClick={onClear}
          className="px-4 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
