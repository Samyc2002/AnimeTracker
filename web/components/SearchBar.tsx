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
        className="flex-1 px-4 py-2 bg-[#0f0f23] border border-[#3a3a5c] rounded-lg text-gray-200 focus:border-purple-500 outline-none"
      />
      <button
        onClick={() => query.trim() && onSearch(query.trim())}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
      >
        Search
      </button>
    </div>
  );
}
