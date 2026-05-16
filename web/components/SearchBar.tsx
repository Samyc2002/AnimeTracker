'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';

export interface SearchBarHandle {
  clear: () => void;
  focus: () => void;
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  filterPanelOpen?: boolean;
  onToggleFilterPanel?: () => void;
  activeFilterCount?: number;
}

const SearchBar = forwardRef<SearchBarHandle, SearchBarProps>(function SearchBar(
  {
    onSearch,
    onQueryChange,
    placeholder = 'Search anime...',
    filterPanelOpen = false,
    onToggleFilterPanel,
    activeFilterCount = 0,
  },
  ref,
) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;

  useImperativeHandle(ref, () => ({
    clear() {
      setQuery('');
      onQueryChangeRef.current?.('');
    },
    focus() {
      inputRef.current?.focus();
    },
  }));

  function handleChange(value: string) {
    setQuery(value);
    onQueryChangeRef.current?.(value.trim());
  }

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timeout = setTimeout(() => onSearch(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query, onSearch]);

  const badgeColor = sfwMode ? 'bg-teal-500' : 'bg-rose-500';

  return (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim()) onSearch(query.trim());
        }}
        placeholder={placeholder}
        className={`w-full px-4 py-2 pr-10 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 focus:border-${theme.accent}-500 outline-none`}
      />
      {onToggleFilterPanel && (
        <button
          onClick={onToggleFilterPanel}
          className={`absolute right-2 p-1 rounded transition-colors ${
            filterPanelOpen
              ? theme.btnText
              : 'text-gray-500 hover:text-gray-300'
          }`}
          title="Filters"
        >
          <div className="relative">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="4" x2="15" y2="4" />
              <line x1="5" y1="9" x2="13" y2="9" />
              <line x1="7" y1="14" x2="11" y2="14" />
            </svg>
            {activeFilterCount > 0 && (
              <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 ${badgeColor} text-white text-[9px] font-bold rounded-full flex items-center justify-center`}>
                {activeFilterCount}
              </span>
            )}
          </div>
        </button>
      )}
    </div>
  );
});

export default SearchBar;
