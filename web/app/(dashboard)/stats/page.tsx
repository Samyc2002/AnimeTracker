'use client';

import { useTitle } from '@/lib/useTitle';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import RequireAuth from '@/components/RequireAuth';
import { Spinner } from '@/components/ui/Spinner';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

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
  engagement?: {
    active_1d: number;
    active_7d: number;
    active_30d: number;
    stickiness_pct: number;
  };
  retention_cohorts?: Array<{
    label: string;
    cohort_size: number;
    week_1_pct: number | null;
    week_2_pct: number | null;
    week_3_pct: number | null;
    week_4_pct: number | null;
    week_1_count: number | null;
    week_2_count: number | null;
    week_3_count: number | null;
    week_4_count: number | null;
  }>;
  feature_adoption?: Array<{
    feature: string;
    count: number;
    pct: number;
  }>;
  growth_funnel?: {
    signed_up: number;
    added_1: number;
    added_3: number;
    returned_7d: number;
    active_7d: number;
  };
  charts?: {
    dau_30d: Array<{ date: string; count: number }>;
    signups_30d: Array<{ date: string; count: number }>;
    watchlist_status_distribution: Array<{ status: string; count: number }>;
    watch_order_30d: Array<{ date: string; count: number }>;
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
  accent = 'teal',
  pulse = false,
}: {
  label: string;
  value: number;
  icon: string;
  accent?: 'teal' | 'emerald' | 'blue' | 'amber' | 'rose';
  pulse?: boolean;
}) {
  const accentColors: Record<string, string> = {
    teal: 'from-teal-500/20 to-teal-600/5 border-teal-500/20',
    rose: 'from-rose-500/20 to-rose-600/5 border-rose-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
  };

  const textColors: Record<string, string> = {
    teal: 'text-teal-400',
    rose: 'text-rose-400',
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

function InfoTooltip({ text }: { text: string }) {
  return (
    <div className="group/info relative inline-block ml-1.5 align-middle">
      <svg className="w-3.5 h-3.5 text-gray-600 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#0b0e14] border border-[#253040] rounded-lg px-3 py-2 opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-20 w-52 text-[10px] leading-relaxed text-gray-400">
        {text}
      </div>
    </div>
  );
}

const ACTIVE_USER_TOOLTIP = 'User counted as active if they added a watchlist entry or watched an episode in this window.';

function EngagementHealthSection({
  engagement,
  themeAccent,
}: {
  engagement: NonNullable<Stats['engagement']>;
  themeAccent: 'teal' | 'rose';
}) {
  const stickinessAccent: 'rose' | 'amber' | 'emerald' =
    engagement.stickiness_pct < 10 ? 'rose' :
    engagement.stickiness_pct < 20 ? 'amber' : 'emerald';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Engagement Health
        <InfoTooltip text={ACTIVE_USER_TOOLTIP} />
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active users (1d)" value={engagement.active_1d} icon="📈" accent={themeAccent} />
        <StatCard label="Active users (7d)" value={engagement.active_7d} icon="📊" accent="blue" />
        <StatCard label="Active users (30d)" value={engagement.active_30d} icon="📉" accent="emerald" />
        <div
          className={`relative overflow-hidden rounded-xl border bg-gradient-to-br backdrop-blur-sm p-5 ${
            stickinessAccent === 'rose' ? 'from-rose-500/20 to-rose-600/5 border-rose-500/20' :
            stickinessAccent === 'amber' ? 'from-amber-500/20 to-amber-600/5 border-amber-500/20' :
            'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Stickiness (DAU/MAU)
              </p>
              <p className={`text-3xl font-bold ${
                stickinessAccent === 'rose' ? 'text-rose-400' :
                stickinessAccent === 'amber' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {engagement.stickiness_pct}%
              </p>
            </div>
            <span className="text-2xl opacity-60">🎯</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RetentionCohortTable({
  cohorts,
}: {
  cohorts: NonNullable<Stats['retention_cohorts']>;
}) {
  const renderCell = (pct: number | null, count: number | null) => {
    if (pct === null) return <span className="text-gray-600">&mdash;</span>;
    if (pct === 0) return <span className="text-gray-500">0% <span className="text-gray-600 text-[10px]">(0)</span></span>;
    const intensity =
      pct >= 75 ? 'text-emerald-400' :
      pct >= 50 ? 'text-teal-400' :
      pct >= 25 ? 'text-amber-400' : 'text-red-400';
    return <span className={intensity}>{pct}% <span className="text-gray-600 text-[10px]">({count})</span></span>;
  };

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
        Retention Cohorts
      </h2>
      <p className="text-[10px] text-gray-600 mb-3">Cohort sizes are small -- interpret percentages with caution.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#253040]">
              <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Signup week</th>
              <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Signups</th>
              <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Week 1</th>
              <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Week 2</th>
              <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Week 3</th>
              <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Week 4</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.label} className="border-b border-[#253040]/50 hover:bg-[#1c2333] transition-colors">
                <td className="py-2.5 px-3 text-gray-300 font-medium">{c.label}</td>
                <td className="py-2.5 px-3 text-right text-gray-300">{c.cohort_size}</td>
                <td className="py-2.5 px-3 text-right">{renderCell(c.week_1_pct, c.week_1_count)}</td>
                <td className="py-2.5 px-3 text-right">{renderCell(c.week_2_pct, c.week_2_count)}</td>
                <td className="py-2.5 px-3 text-right">{renderCell(c.week_3_pct, c.week_3_count)}</td>
                <td className="py-2.5 px-3 text-right">{renderCell(c.week_4_pct, c.week_4_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureAdoptionChart({
  features,
}: {
  features: NonNullable<Stats['feature_adoption']>;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Feature Adoption</h2>
      <div className="space-y-2.5">
        {features.map((f) => (
          <div key={f.feature} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-40 shrink-0 text-right">{f.feature}</span>
            <div className="flex-1 h-6 bg-[#141925] rounded-md overflow-hidden border border-[#253040]/50">
              <div
                className="h-full bg-teal-500/50 rounded-md transition-all duration-500"
                style={{ width: `${Math.max(f.pct, 2)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-20 shrink-0">
              {f.pct}% <span className="text-gray-600">({f.count})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrowthFunnelSection({
  funnel,
}: {
  funnel: NonNullable<Stats['growth_funnel']>;
}) {
  const stages = [
    { label: 'Signed up', value: funnel.signed_up },
    { label: 'Added 1+ entry', value: funnel.added_1 },
    { label: 'Added 3+ entries', value: funnel.added_3 },
    { label: 'Returned within 7d', value: funnel.returned_7d },
    { label: 'Active last 7d', value: funnel.active_7d },
  ];

  const max = stages[0].value || 1;

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
        Growth Funnel
      </h2>
      <p className="text-[10px] text-gray-600 mb-3">Users who signed up in the last 30 days.</p>
      <div className="space-y-2">
        {stages.map((stage, i) => {
          const prevValue = i === 0 ? stage.value : stages[i - 1].value;
          const pctOfPrev = prevValue > 0 ? Math.round((stage.value / prevValue) * 100) : 0;
          const widthPct = max > 0 ? (stage.value / max) * 100 : 0;

          return (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-36 shrink-0 text-right">{stage.label}</span>
              <div className="flex-1 h-7 relative">
                <div
                  className="h-full bg-teal-500/40 rounded-md transition-all duration-500"
                  style={{ width: `${Math.max(widthPct, 3)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-24 shrink-0">
                {stage.value}{' '}
                {i > 0 && (
                  <span className={`${pctOfPrev >= 50 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    ({pctOfPrev}%)
                  </span>
                )}
                {i === 0 && <span className="text-gray-600">(100%)</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  Watching: '#2dd4bf',
  Completed: '#a78bfa',
  Planned: '#60a5fa',
  Dropped: '#f87171',
  'On Hold': '#fbbf24',
  Paused: '#fbbf24',
  Unknown: '#6b7280',
};

function formatXDate(d: unknown) {
  const date = new Date(String(d));
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#141925] border border-[#253040] rounded-xl p-5">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ChartsSection({ charts }: { charts: NonNullable<Stats['charts']> }) {
  const statusColors = charts.watchlist_status_distribution.map(
    d => STATUS_COLORS[d.status] || '#6b7280'
  );

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Charts</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Active users -- last 30 days">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={charts.dau_30d}>
              <CartesianGrid strokeDasharray="3 3" stroke="#253040" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={formatXDate} interval={6} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#0b0e14', border: '1px solid #253040', borderRadius: 8, fontSize: 12 }}
                labelFormatter={formatXDate}
              />
              <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Signups per day -- last 30 days">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.signups_30d}>
              <CartesianGrid strokeDasharray="3 3" stroke="#253040" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={formatXDate} interval={6} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#0b0e14', border: '1px solid #253040', borderRadius: 8, fontSize: 12 }}
                labelFormatter={formatXDate}
              />
              <Bar dataKey="count" fill="#22d3ee" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Watchlist status distribution">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={charts.watchlist_status_distribution}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {charts.watchlist_status_distribution.map((_, i) => (
                  <Cell key={i} fill={statusColors[i]} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#0b0e14', border: '1px solid #253040', borderRadius: 8, fontSize: 12 }}
              />
              <Legend
                formatter={(value: string) => <span className="text-gray-400 text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Watch order computes -- last 30 days">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={charts.watch_order_30d}>
              <CartesianGrid strokeDasharray="3 3" stroke="#253040" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={formatXDate} interval={6} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#0b0e14', border: '1px solid #253040', borderRadius: 8, fontSize: 12 }}
                labelFormatter={formatXDate}
              />
              <Line type="monotone" dataKey="count" stroke="#2dd4bf" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

export default function AdminPageGuarded() {
  return <RequireAuth><AdminPage /></RequireAuth>;
}

function AdminPage() {
  useTitle('Analytics');
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const themeAccent = theme.accent as 'teal' | 'rose';
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
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
    const interval = setInterval(fetchStats, 300_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  useEffect(() => {
    if (forbidden) router.replace('/watchlist');
  }, [forbidden, router]);

  if (loading || forbidden) {
    return (
      <div className="flex justify-center mt-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-12 text-center">
        <p className="text-red-400 mb-2">Failed to load analytics</p>
        <p className="text-gray-500 text-sm">{error}</p>
        <button onClick={fetchStats} className={`mt-4 text-sm ${theme.link}`}>
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
              Last updated {lastRefresh.toLocaleTimeString()} &middot; auto-refreshes every 5 min
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
          <StatCard label="Total Users" value={stats.totals.users} icon="👤" accent={themeAccent} />
          <StatCard label="Watchlist Entries" value={stats.totals.watchlist_entries} icon="📋" accent="blue" />
          <StatCard label="Episodes Watched" value={stats.totals.watched_episodes} icon="▶" accent="emerald" />
          <StatCard label="Online Now" value={stats.online_now} icon="🟢" accent="emerald" pulse />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Last 7 Days</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Active Users" value={stats.last_7_days.active_users} icon="📊" accent={themeAccent} />
          <StatCard label="Watchlist Adds" value={stats.last_7_days.watchlist_adds} icon="➕" accent="blue" />
          <StatCard label="Episodes Watched" value={stats.last_7_days.episodes_watched} icon="🎬" accent="emerald" />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Last 30 Days</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="New Signups" value={stats.last_30_days.new_signups} icon="🆕" accent="amber" />
        </div>
      </div>

      {(stats.engagement || stats.retention_cohorts || stats.feature_adoption || stats.growth_funnel || stats.charts) && (
        <div className="border-t border-[#253040] mt-10 pt-8">
          {stats.engagement && (
            <EngagementHealthSection engagement={stats.engagement} themeAccent={themeAccent} />
          )}
          {stats.retention_cohorts && (
            <RetentionCohortTable cohorts={stats.retention_cohorts} />
          )}
          {stats.feature_adoption && (
            <FeatureAdoptionChart features={stats.feature_adoption} />
          )}
          {stats.growth_funnel && (
            <GrowthFunnelSection funnel={stats.growth_funnel} />
          )}
          {stats.charts && (
            <ChartsSection charts={stats.charts} />
          )}
        </div>
      )}
    </div>
  );
}
