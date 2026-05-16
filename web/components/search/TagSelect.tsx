'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

interface Tag {
  id: number;
  name: string;
  description: string | null;
  category: string;
  is_adult: boolean;
}

interface TagSelectProps {
  label: string;
  selected: string[];
  onChange: (next: string[]) => void;
  excludeTags?: string[];
}

export default function TagSelect({ label, selected, onChange, excludeTags = [] }: TagSelectProps) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from('anime_taxonomy_tags')
      .select('id, name, description, category, is_adult')
      .order('name')
      .then(({ data }) => {
        if (data) setAllTags(data as Tag[]);
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    let tags = allTags;
    if (sfwMode) tags = tags.filter((t) => !t.is_adult);
    tags = tags.filter((t) => !excludeTags.includes(t.name) && !selected.includes(t.name));
    if (query.length > 0) {
      const q = query.toLowerCase();
      tags = tags.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }
    return tags.slice(0, 50);
  }, [allTags, sfwMode, excludeTags, selected, query]);

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((t) => t !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((t) => (
            <span
              key={t}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}
            >
              {t}
              <button onClick={() => toggle(t)} className="hover:text-gray-200 text-[10px] leading-none">
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
        {selected.length === 0 ? 'Select tags...' : 'Add more...'}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#141925] border border-[#253040] rounded-lg shadow-lg">
          <div className="p-2 border-b border-[#253040]/50">
            <input
              type="text"
              placeholder="Search tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-md text-gray-200 outline-none focus:border-gray-500"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto thin-scrollbar">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-500">No tags found</div>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => { toggle(t.name); setQuery(''); }}
                title={t.description ?? undefined}
                className="w-full px-3 py-1.5 text-xs text-left text-gray-300 hover:bg-[#1c2333] transition-colors"
              >
                <span>{t.name}</span>
                <span className="float-right text-gray-500">{t.category}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
