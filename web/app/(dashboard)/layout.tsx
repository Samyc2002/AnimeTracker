'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { account } from '@/lib/appwrite';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import { SfwProvider } from '@/lib/sfw-context';

interface AuthContextType {
  authed: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ authed: false, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    account.get()
      .then(async (user) => {
        setAuthed(true);
        setLoading(false);
        try {
          const jwt = await account.createJWT();
          localStorage.setItem('anime_tracker_ext_jwt', JSON.stringify({ jwt: jwt.jwt, userId: user.$id }));
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

  return (
    <AuthContext.Provider value={{ authed, loading }}>
      <SfwProvider>
        <div data-dashboard-layout className="min-h-screen bg-[#0b0e14] flex flex-col">
          <NavBar />
          <main className="max-w-5xl mx-auto px-6 py-8 flex-1 w-full">{children}</main>
          <Footer />
        </div>
      </SfwProvider>
    </AuthContext.Provider>
  );
}
