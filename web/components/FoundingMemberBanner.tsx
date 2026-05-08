'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import Image from 'next/image';
import { getBadgeUrl } from '@/lib/achievements/badge-url';

type BannerState = 'loading' | 'eligible' | 'progress' | 'earned' | 'closed' | 'hidden';

export default function FoundingMemberBanner() {
  const { userId } = useAuth();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [state, setState] = useState<BannerState>('loading');
  const [remaining, setRemaining] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userId) { setState('hidden'); return; }
    if (typeof window !== 'undefined' && localStorage.getItem('founding_banner_dismissed')) {
      setState('hidden');
      return;
    }

    async function check() {
      try {
        const { data: earned } = await supabase
          .from('user_achievements')
          .select('unlocked')
          .eq('user_id', userId!)
          .eq('achievement_id', 'founding_member')
          .limit(1);

        if (earned && earned.length > 0 && earned[0].unlocked) {
          setState('earned');
          return;
        }

        const { count: wlCount } = await supabase
          .from('watchlist_entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId!);

        setWatchlistCount(wlCount || 0);

        const res = await fetch('/api/achievements/founding-status');
        if (res.ok) {
          const data = await res.json();
          const spotsLeft = Math.max(0, (data.max || 100) - (data.count || 0));
          setRemaining(spotsLeft);

          if (spotsLeft === 0) {
            setState('closed');
          } else if ((wlCount || 0) >= 3) {
            setState('eligible');
          } else {
            setState('progress');
          }
        } else {
          setState('hidden');
        }
      } catch {
        setState('hidden');
      }
    }
    check();
  }, [userId]);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem('founding_banner_dismissed', '1');
  }

  if (state === 'loading' || state === 'hidden' || dismissed) return null;

  if (state === 'earned') return null;

  return (
    <div className="relative bg-gradient-to-r from-amber-900/30 to-yellow-900/20 border border-amber-700/30 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
      <Image
        src={getBadgeUrl('founding_member')}
        alt="Founding Member"
        width={36}
        height={36}
        className="rounded flex-shrink-0"
        unoptimized
      />
      <div className="flex-1 min-w-0">
        {state === 'eligible' && (
          <p className="text-sm text-amber-200">
            You&apos;re eligible for the <span className="font-semibold">Founding Member</span> badge! Add one more anime to claim it.
            <span className="text-amber-400/60 text-xs ml-1">({remaining} spots left)</span>
          </p>
        )}
        {state === 'progress' && (
          <p className="text-sm text-gray-300">
            First 100 active members get the <span className="font-semibold text-amber-300">Founding Member</span> badge.
            <span className="text-gray-500 text-xs ml-1">{3 - watchlistCount} anime away &middot; {remaining} spots left</span>
          </p>
        )}
        {state === 'closed' && (
          <p className="text-sm text-gray-400">
            The <span className="font-semibold">Founding Member</span> program has closed. All 100 spots have been claimed.
          </p>
        )}
      </div>
      <button
        onClick={dismiss}
        className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
