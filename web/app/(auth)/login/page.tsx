'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { AuthInput } from '@/components/ui/AuthInput';
import { AuthSubmitButton } from '@/components/ui/AuthSubmitButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: { user } } = await supabase.auth.getUser();
        if (session && user) {
          localStorage.setItem('anime_tracker_ext_jwt', JSON.stringify({ jwt: session.access_token, userId: user.id }));
        }
      } catch {
        // JWT creation is non-critical
      }
      router.push('/watchlist');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError('Enter your email first');
      return;
    }
    setResetLoading(true);
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
    setResetLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0e14]">
      <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-[#111827] rounded-xl">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400 mb-6 text-center">Anime Tracker</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <AuthInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {resetSent && <p className="text-emerald-400 text-sm">Password reset link sent! Check your email.</p>}
          <AuthSubmitButton disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </AuthSubmitButton>
        </form>
        <div className="mt-4 text-center text-sm">
          <button
            onClick={handleResetPassword}
            disabled={resetLoading}
            className="text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            {resetLoading ? 'Sending...' : 'Forgot password?'}
          </button>
        </div>
        <p className="mt-2 text-center text-sm text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-teal-400 hover:text-teal-300">Sign up</Link>
        </p>
      </div>
      </div>
      <Footer />
    </div>
  );
}
