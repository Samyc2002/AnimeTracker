'use client';

import type { ProviderName, SearchFilterState } from '@/lib/search/types';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import SortDropdown from '@/components/search/SortDropdown';

const PROVIDER_LABELS: Record<ProviderName, string> = {
  anilist: 'AniList',
  jikan: 'Jikan (MAL)',
  kitsu: 'Kitsu',
  anime_cache: 'Cache',
};

interface HeaderStripProps {
  activeProvider: ProviderName;
  viewMode: 'list' | 'card';
  onViewModeChange: (mode: 'list' | 'card') => void;
  filters: SearchFilterState;
  supportedSorts: string[];
  onSortChange: (sort: string | null) => void;
}

export default function HeaderStrip({
  activeProvider,
  viewMode,
  onViewModeChange,
  filters,
  supportedSorts,
  onSortChange,
}: HeaderStripProps) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);

  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs text-gray-500">
        Results from <span className={theme.btnText}>{PROVIDER_LABELS[activeProvider]}</span>
      </span>

      <SortDropdown
        filters={filters}
        supportedSorts={supportedSorts}
        activeProvider={activeProvider}
        onSortChange={onSortChange}
      />

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => onViewModeChange('list')}
          aria-pressed={viewMode === 'list'}
          className={`p-1.5 rounded transition-colors ${
            viewMode === 'list' ? `${theme.activeTab} text-white` : 'text-gray-500 hover:text-gray-300'
          }`}
          title="List view"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="2" y1="8" x2="14" y2="8" />
            <line x1="2" y1="12" x2="14" y2="12" />
          </svg>
        </button>
        <button
          onClick={() => onViewModeChange('card')}
          aria-pressed={viewMode === 'card'}
          className={`p-1.5 rounded transition-colors ${
            viewMode === 'card' ? `${theme.activeTab} text-white` : 'text-gray-500 hover:text-gray-300'
          }`}
          title="Card view"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
