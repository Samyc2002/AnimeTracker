'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { AuthInput } from '@/components/ui/AuthInput';
import { AuthSubmitButton } from '@/components/ui/AuthSubmitButton';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push('/watchlist'), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0e14]">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm p-8 bg-[#111827] rounded-xl">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400 mb-6 text-center">
            Reset Password
          </h1>
          {done ? (
            <div className="text-center">
              <p className="text-emerald-400 text-sm mb-2">Password updated!</p>
              <p className="text-gray-500 text-xs">Redirecting to your watchlist...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <AuthInput
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <AuthInput
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <AuthSubmitButton disabled={loading}>
                {loading ? 'Updating...' : 'Set New Password'}
              </AuthSubmitButton>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-gray-400">
            <Link href="/login" className="text-teal-400 hover:text-teal-300">Back to login</Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
