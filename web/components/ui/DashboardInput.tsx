'use client';

import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';

export function DashboardInput({
  focusColor = 'neutral',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  focusColor?: 'neutral' | 'accent';
}) {
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const focus = focusColor === 'accent'
    ? `focus:border-${theme.accent}-500`
    : 'focus:border-gray-500';
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm placeholder:text-gray-600 focus:outline-none ${focus}`}
    />
  );
}
