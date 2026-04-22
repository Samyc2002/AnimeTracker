'use client';

import { useState, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({ onSearch, placeholder = 'Search anime...' }: SearchBarProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timeout = setTimeout(() => onSearch(query.trim()), 400);
    return () => clearTimeout(timeout);
  }, [query, onSearch]);

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim()) onSearch(query.trim());
        }}
        placeholder={placeholder}
        className="flex-1 px-4 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 focus:border-teal-500 outline-none"
      />
      <button
        onClick={() => query.trim() && onSearch(query.trim())}
        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium"
      >
        Search
      </button>
    </div>
  );
}
