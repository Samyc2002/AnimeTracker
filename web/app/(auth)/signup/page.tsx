'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { AuthInput } from '@/components/ui/AuthInput';
import { AuthSubmitButton } from '@/components/ui/AuthSubmitButton';

export default function SignupPage() {
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
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
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
      setError(err instanceof Error ? err.message : 'Signup failed');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0e14]">
      <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-[#111827] rounded-xl">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400 mb-6 text-center">Create an account</h1>
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
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <AuthSubmitButton disabled={loading}>
            {loading ? 'Creating account...' : 'Sign up'}
          </AuthSubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-teal-400 hover:text-teal-300">Sign in</Link>
        </p>
      </div>
      </div>
      <Footer />
    </div>
  );
}
