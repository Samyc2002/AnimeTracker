'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { account } from '@/lib/appwrite';
import NavBar from '@/components/NavBar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    account.get()
      .then(async (user) => {
        setAuthed(true);
        try {
          const jwt = await account.createJWT();
          localStorage.setItem('anime_tracker_ext_jwt', JSON.stringify({ jwt: jwt.jwt, userId: user.$id }));
        } catch {
          // JWT creation is non-critical
        }
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(async () => {
      try {
        const jwt = await account.createJWT();
        const user = await account.get();
        localStorage.setItem('anime_tracker_ext_jwt', JSON.stringify({ jwt: jwt.jwt, userId: user.$id }));
      } catch {
        // Session may have expired
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    async function heartbeat() {
      try {
        const user = await account.get();
        await fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.$id }),
        });
      } catch {
        // Non-critical
      }
    }
    heartbeat();
    const interval = setInterval(heartbeat, 60_000);
    return () => clearInterval(interval);
  }, [authed]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e14]">
      <NavBar />
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
