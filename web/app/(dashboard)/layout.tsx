'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import NavBar from '@/components/NavBar';
import ProviderStatusBanner from '@/components/ProviderStatusBanner';
import Footer from '@/components/Footer';
import { SfwProvider } from '@/lib/sfw-context';
import { AuthContext } from '@/lib/auth-context';

export { useAuth } from '@/lib/auth-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser()
      .then(async ({ data: { user } }) => {
        if (!user) {
          setAuthed(false);
          setLoading(false);
          return;
        }
        setAuthed(true);
        setLoading(false);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            localStorage.setItem('anime_tracker_ext_jwt', JSON.stringify({ jwt: session.access_token, userId: user.id }));
          }
        } catch {
          // JWT creation is non-critical
        }
      })
      .catch(() => {
        setAuthed(false);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: { user } } = await supabase.auth.getUser();
        if (session && user) {
          localStorage.setItem('anime_tracker_ext_jwt', JSON.stringify({ jwt: session.access_token, userId: user.id }));
        }
      } catch {
        // Session may have expired
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    async function pollNotifications() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await fetch('/api/notifications/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
      } catch {
        // Non-critical
      }
    }
    pollNotifications();
    const pollInterval = setInterval(pollNotifications, 15 * 60 * 1000);
    return () => clearInterval(pollInterval);
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    async function heartbeat() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
      } catch {
        // Non-critical
      }
    }
    heartbeat();
    const interval = setInterval(heartbeat, 60_000);
    return () => clearInterval(interval);
  }, [authed]);

  return (
    <AuthContext.Provider value={{ authed, loading }}>
      <SfwProvider>
        <div data-dashboard-layout className="min-h-screen bg-[#0b0e14] flex flex-col">
          <ProviderStatusBanner />
          <NavBar />
          <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 xl:pb-8 flex-1 w-full">{children}</main>
          <Footer />
        </div>
      </SfwProvider>
    </AuthContext.Provider>
  );
}
