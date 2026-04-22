'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/app/(dashboard)/layout';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authed, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authed) {
      router.replace('/login');
    }
  }, [authed, loading, router]);

  if (loading) {
    return (
      <div className="flex justify-center mt-12">
        <div className="w-6 h-6 border-2 border-[#253040] border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) return null;

  return <>{children}</>;
}
