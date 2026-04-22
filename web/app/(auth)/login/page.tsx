'use client';

import { useState } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/components/Footer';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await account.createEmailPasswordSession(email, password);
      try {
        const jwt = await account.createJWT();
        const user = await account.get();
        localStorage.setItem('anime_tracker_ext_jwt', JSON.stringify({ jwt: jwt.jwt, userId: user.$id }));
      } catch {
        // JWT creation is non-critical
      }
      router.push('/watchlist');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0e14]">
      <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-[#111827] rounded-xl">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400 mb-6 text-center">Anime Tracker</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 focus:border-teal-500 outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 focus:border-teal-500 outline-none"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-teal-400 hover:text-teal-300">Sign up</Link>
        </p>
      </div>
      </div>
      <Footer />
    </div>
  );
}
