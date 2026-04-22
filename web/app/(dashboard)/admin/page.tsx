'use client';

import { useEffect, useState, useCallback } from 'react';

interface Stats {
  online_now: number;
  totals: {
    users: number;
    watchlist_entries: number;
    watched_episodes: number;
  };
  last_7_days: {
    active_users: number;
    watchlist_adds: number;
    episodes_watched: number;
  };
  last_30_days: {
    new_signups: number;
  };
  generated_at: string;
}

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = performance.now();
    const from = display;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

function StatCard({
  label,
  value,
  icon,
  accent = 'purple',
  pulse = false,
}: {
  label: string;
  value: number;
  icon: string;
  accent?: 'purple' | 'emerald' | 'blue' | 'amber';
  pulse?: boolean;
}) {
  const accentColors = {
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
  };

  const textColors = {
    purple: 'text-purple-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br backdrop-blur-sm p-5 ${accentColors[accent]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{label}</p>
          <p className={`text-3xl font-bold ${textColors[accent]}`}>
            <AnimatedNumber value={value} />
          </p>
        </div>
        <div className="relative">
          <span className="text-2xl opacity-60">{icon}</span>
          {pulse && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
          )}
          {pulse && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex justify-center mt-24">
        <div className="w-8 h-8 border-2 border-[#3a3a5c] border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-12 text-center">
        <p className="text-red-400 mb-2">Failed to load analytics</p>
        <p className="text-gray-500 text-sm">{error}</p>
        <button onClick={fetchStats} className="mt-4 text-sm text-purple-400 hover:text-purple-300">
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Analytics Dashboard</h1>
          {lastRefresh && (
            <p className="text-xs text-gray-600 mt-1">
              Last updated {lastRefresh.toLocaleTimeString()} &middot; auto-refreshes every 30s
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-sm font-medium text-emerald-400">
            {stats.online_now} online now
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">All Time</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats.totals.users} icon="👤" accent="purple" />
          <StatCard label="Watchlist Entries" value={stats.totals.watchlist_entries} icon="📋" accent="blue" />
          <StatCard label="Episodes Watched" value={stats.totals.watched_episodes} icon="▶" accent="emerald" />
          <StatCard label="Online Now" value={stats.online_now} icon="🟢" accent="emerald" pulse />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Last 7 Days</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Active Users" value={stats.last_7_days.active_users} icon="📊" accent="purple" />
          <StatCard label="Watchlist Adds" value={stats.last_7_days.watchlist_adds} icon="➕" accent="blue" />
          <StatCard label="Episodes Watched" value={stats.last_7_days.episodes_watched} icon="🎬" accent="emerald" />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Last 30 Days</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="New Signups" value={stats.last_30_days.new_signups} icon="🆕" accent="amber" />
        </div>
      </div>
    </div>
  );
}
