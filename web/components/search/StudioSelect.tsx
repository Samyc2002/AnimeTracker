'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

interface Studio {
  id: number;
  name: string;
  favourites: number;
}

interface StudioSelectProps {
  selected: number[];
  onChange: (next: number[]) => void;
}

export default function StudioSelect({ selected, onChange }: StudioSelectProps) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Studio[]>([]);
  const [selectedNames, setSelectedNames] = useState(() => new Map<number, string>());
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, Studio[]>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    const missing = selected.filter((id) => !selectedNames.has(id));
    if (missing.length === 0) return;
    supabase
      .from('anime_taxonomy_studios')
      .select('id, name')
      .in('id', missing)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSelectedNames((prev) => {
            const next = new Map(prev);
            for (const s of data) next.set(s.id, s.name);
            return next;
          });
        }
      });
  }, [selected, selectedNames]);

  const fetchStudios = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const cached = cacheRef.current.get(q);
    if (cached) {
      setResults(cached);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/taxonomy/studios?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: Studio[] = await res.json();
        cacheRef.current.set(q, data);
        setResults(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchStudios(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchStudios]);

  function addStudio(studio: Studio) {
    if (!selected.includes(studio.id)) {
      onChange([...selected, studio.id]);
      setSelectedNames((prev) => new Map(prev).set(studio.id, studio.name));
    }
    setQuery('');
    setResults([]);
  }

  function removeStudio(id: number) {
    onChange(selected.filter((s) => s !== id));
    setSelectedNames((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-gray-400 mb-1.5">Studios</label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((id) => (
            <span
              key={id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}
            >
              {selectedNames.get(id) ?? `#${id}`}
              <button onClick={() => removeStudio(id)} className="hover:text-gray-200 text-[10px] leading-none">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-2 py-1 text-xs text-left bg-[#0b0e14] border border-[#253040] rounded-md text-gray-400 hover:text-gray-200"
      >
        {selected.length === 0 ? 'Search studios...' : 'Add more...'}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#141925] border border-[#253040] rounded-lg shadow-lg">
          <div className="p-2 border-b border-[#253040]/50">
            <input
              type="text"
              placeholder="Type to search studios..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto thin-scrollbar">
            {loading && (
              <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>
            )}
            {!loading && query.length >= 2 && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-500">No studios found</div>
            )}
            {!loading && query.length > 0 && query.length < 2 && (
              <div className="px-3 py-2 text-xs text-gray-500">Type at least 2 characters</div>
            )}
            {results
              .filter((s) => !selected.includes(s.id))
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => addStudio(s)}
                  className="w-full px-3 py-1.5 text-xs text-left text-gray-300 hover:bg-[#1c2333] transition-colors"
                >
                  {s.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
