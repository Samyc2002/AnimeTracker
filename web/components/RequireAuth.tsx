'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Spinner';

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
        <Spinner />
      </div>
    );
  }

  if (!authed) return null;

  return <>{children}</>;
}
