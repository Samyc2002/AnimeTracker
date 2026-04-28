'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authed, loading } = useAuth();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authed) {
      router.replace('/login');
    }
  }, [authed, loading, router]);

  if (loading) {
    return (
      <div className="flex justify-center mt-12">
        <div className={`w-6 h-6 border-2 border-[#253040] ${theme.spinnerBorder} rounded-full animate-spin`} />
      </div>
    );
  }

  if (!authed) return null;

  return <>{children}</>;
}
