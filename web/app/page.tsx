'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { account } from '@/lib/appwrite';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    account.get()
      .then(() => router.replace('/watchlist'))
      .catch(() => router.replace('/login'));
  }, [router]);

  return null;
}
