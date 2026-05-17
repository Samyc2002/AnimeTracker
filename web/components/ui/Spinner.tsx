'use client';

import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
} as const;

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  return (
    <div className={`${sizes[size]} border-2 border-[#253040] ${theme.spinnerBorder} rounded-full animate-spin`} />
  );
}
