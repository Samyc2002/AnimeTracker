'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SfwProvider, useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/StatusBadge';
import { DashboardInput } from '@/components/ui/DashboardInput';
import { AuthInput } from '@/components/ui/AuthInput';
import { AuthSubmitButton } from '@/components/ui/AuthSubmitButton';

/* ─── Helpers ───────────────────────────────────────────── */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16">
      <h2 className="text-lg font-bold text-gray-100 border-b border-[#253040] pb-2 mb-6">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        {note && <span className="text-[10px] text-gray-600">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 mb-3">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-gray-600 min-w-[80px]">{children}</span>;
}

/* ─── Inventory content (needs SfwProvider ancestor) ──── */

function InventoryContent() {
  const { sfwMode, setSfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [sfwToggleDemo, setSfwToggleDemo] = useState(true);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-gray-200">
      <header className="sticky top-0 z-50 bg-[#0b0e14]/95 backdrop-blur border-b border-[#253040] px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">
          Visual Inventory
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSfwMode(!sfwMode)}
            className="px-3 py-1 text-xs rounded border border-[#253040] text-gray-400 hover:text-gray-200"
          >
            Theme: {sfwMode ? 'SFW (teal)' : 'NSFW (rose)'}
          </button>
          <span className="text-[10px] text-gray-600">DEV ONLY</span>
        </div>
      </header>

      <nav className="sticky top-[49px] z-40 bg-[#0b0e14]/90 backdrop-blur border-b border-[#253040] px-6 py-2 flex gap-4 overflow-x-auto thin-scrollbar text-xs">
        {[
          ['#group-a', 'A: Extracted'],
          ['#group-b', 'B: Deferred'],
          ['#c1', 'Buttons'],
          ['#c2', 'Cards'],
          ['#c3', 'Dropdowns'],
          ['#c4', 'Toggles'],
          ['#c5', 'Tabs'],
          ['#c6', 'Badges'],
          ['#c7', 'Nav'],
          ['#c8', 'Gradient'],
          ['#c9', 'Banners'],
          ['#c10', 'Loaders'],
          ['#c11', 'Inputs'],
          ['#c12', 'Empty'],
          ['#c13', 'Errors'],
          ['#c14', 'Toast'],
          ['#c15', 'Profile'],
          ['#c16', 'Anime Hero'],
          ['#c17', 'Stats Viz'],
          ['#c18', 'Episode Grid'],
          ['#c19', 'Anime Grid Card'],
          ['#c20', 'Overlays'],
          ['#c21', 'Composite'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="text-gray-500 hover:text-gray-200 whitespace-nowrap transition-colors">
            {label}
          </a>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* ━━━ GROUP A: Extracted Components ━━━ */}
        <Section id="group-a" title="Group A — Extracted Components">

          <SubSection title="A1. Spinner" note="components/ui/Spinner.tsx">
            <Row>
              <Label>md (default)</Label>
              <Spinner size="md" />
            </Row>
            <Row>
              <Label>lg</Label>
              <Spinner size="lg" />
            </Row>
          </SubSection>

          <SubSection title="A2. StatusBadge" note="components/ui/StatusBadge.tsx — 7 tones">
            <Row>
              {(['emerald', 'blue', 'amber', 'red', 'purple', 'indigo', 'gray'] as StatusBadgeTone[]).map((tone) => (
                <StatusBadge key={tone} tone={tone}>{tone}</StatusBadge>
              ))}
            </Row>
          </SubSection>

          <SubSection title="A3. DashboardInput" note="components/ui/DashboardInput.tsx — 2 focus colors">
            <Row>
              <Label>neutral</Label>
              <div className="w-64">
                <DashboardInput focusColor="neutral" placeholder="Neutral focus (click to see)" />
              </div>
            </Row>
            <Row>
              <Label>accent</Label>
              <div className="w-64">
                <DashboardInput focusColor="accent" placeholder="Accent focus (click to see)" />
              </div>
            </Row>
          </SubSection>

          <SubSection title="A4. AuthInput" note="components/ui/AuthInput.tsx">
            <Row>
              <div className="w-64">
                <AuthInput type="email" placeholder="email@example.com" />
              </div>
            </Row>
          </SubSection>

          <SubSection title="A5. AuthSubmitButton" note="components/ui/AuthSubmitButton.tsx">
            <Row>
              <div className="w-48">
                <AuthSubmitButton>Sign In</AuthSubmitButton>
              </div>
              <div className="w-48">
                <AuthSubmitButton disabled>Disabled</AuthSubmitButton>
              </div>
            </Row>
          </SubSection>

        </Section>

        {/* ━━━ GROUP B: Deferred Inline Elements ━━━ */}
        <Section id="group-b" title="Group B — Deferred Inline Elements">

          <SubSection title="B1. AnimeCard Status Badges" note="AnimeCard.tsx:21-27 — full-opacity bg, no /60">
            <Row>
              {[
                { label: 'Releasing', cls: 'bg-emerald-900 text-emerald-300' },
                { label: 'Finished', cls: 'bg-blue-900 text-blue-300' },
                { label: 'Not Yet Released', cls: 'bg-amber-900 text-amber-300' },
                { label: 'Cancelled', cls: 'bg-red-900 text-red-300' },
                { label: 'Hiatus', cls: 'bg-gray-700 text-gray-300' },
              ].map((s) => (
                <span key={s.label} className={`px-1.5 py-0.5 rounded font-semibold uppercase text-[9px] ${s.cls}`}>
                  {s.label}
                </span>
              ))}
            </Row>
            <p className="text-[10px] text-gray-600 mt-1">
              Compare with A2 StatusBadge above — these use full opacity (bg-emerald-900 vs bg-emerald-900/60)
            </p>
          </SubSection>

          <SubSection title="B2. Bottom Sheets" note="4 shapes — backdrop + drag handle folded in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Watchlist folder bottom sheet */}
              <div className="relative">
                <p className="text-[10px] text-gray-500 mb-2">Watchlist folder — watchlist/page.tsx:543</p>
                <div className="bg-[#141925] rounded-t-2xl border-t border-x border-[#253040] overflow-hidden">
                  <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-2" />
                  <div className="flex items-center justify-between p-4 border-b border-[#253040]">
                    <span className="text-sm font-semibold text-gray-200">Watching</span>
                    <span className="text-gray-400 text-sm">x</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2 bg-[#0b0e14] rounded-lg p-2 text-xs text-gray-400">
                      Sample entry
                    </div>
                  </div>
                </div>
              </div>

              {/* NavBar mobile drawer */}
              <div className="relative">
                <p className="text-[10px] text-gray-500 mb-2">NavBar mobile drawer — NavBar.tsx:234</p>
                <div className="bg-[#141925] rounded-t-2xl border-t border-x border-[#253040] overflow-hidden">
                  <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-2" />
                  <div className="p-3 space-y-1">
                    {['Playlists', 'Stats', 'Settings'].map((item) => (
                      <div key={item} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-[#1c2333] transition-colors cursor-pointer">
                        {item}
                      </div>
                    ))}
                    <div className="border-t border-[#253040] my-2" />
                    <div className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400">
                      Sign Out
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievements modal (bottom sheet on mobile, centered on xl) */}
              <div className="relative">
                <p className="text-[10px] text-gray-500 mb-2">Achievements — AchievementSection.tsx:72 (also C18a centered modal on xl)</p>
                <div className="bg-[#141925] rounded-t-2xl border-t border-x border-[#253040] overflow-hidden">
                  <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-2" />
                  <div className="flex items-center justify-between p-4 border-b border-[#253040]">
                    <span className="text-sm font-semibold text-gray-200">Achievements</span>
                    <span className="text-gray-400 text-sm">x</span>
                  </div>
                  <div className="p-3 space-y-1.5">
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Earned (2)</h4>
                    <div className="flex items-center gap-2.5 bg-[#0b0e14] rounded-lg p-2.5">
                      <div className="w-7 h-7 rounded bg-amber-600/30 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-200">Founding Member</p>
                        <p className="text-[10px] text-gray-500 truncate">Early adopter badge</p>
                      </div>
                      <span className="text-[9px] text-emerald-400 flex-shrink-0">&#10003;</span>
                    </div>
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5 mt-3">Locked (1)</h4>
                    <div className="flex items-center gap-2.5 bg-[#0b0e14] rounded-lg p-2.5 opacity-50">
                      <div className="w-7 h-7 rounded bg-gray-700 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-400">Binge Watcher</p>
                        <p className="text-[10px] text-gray-600 truncate">Watch 50 episodes</p>
                        <div className="mt-1">
                          <div className="w-full h-1 bg-[#1e2736] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${theme.activeTab}`} style={{ width: '30%' }} />
                          </div>
                          <p className="text-[8px] text-gray-600 mt-0.5">15/50</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommend to buddy */}
              <div className="relative">
                <p className="text-[10px] text-gray-500 mb-2">Recommend to buddy — RecommendToBuddy.tsx:93</p>
                <div className="bg-[#141925] rounded-t-2xl border-t border-x border-[#253040] overflow-hidden">
                  <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-2" />
                  <div className="flex items-center justify-between p-4 border-b border-[#253040]">
                    <span className="text-sm font-semibold text-gray-200">Recommend to Buddy</span>
                    <span className="text-gray-400 text-sm">x</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between bg-[#0b0e14] rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${theme.activeTab}`}>
                          A
                        </div>
                        <span className="text-sm text-gray-200">alice</span>
                      </div>
                      <button className={`px-3 py-1 ${theme.btn} text-white text-xs rounded-lg font-medium`}>Send</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SubSection>

          <SubSection title="B3. Watchlist Folder Count Badge" note="watchlist/page.tsx:500 — unique muted tone">
            <Row>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-[#253040] text-gray-300">3 entries</span>
            </Row>
          </SubSection>

          <SubSection title="B4. AnimeCard Progress Bar" note="AnimeCard.tsx:72 — 2 usages, below threshold">
            <div className="w-64">
              <div className="w-full h-1.5 bg-[#1e2736] rounded-full overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 rounded-full bg-gray-600/40" style={{ width: '80%' }} />
                <div className={`h-full rounded-full ${theme.activeTab} transition-all relative z-10`} style={{ width: '60%' }} />
              </div>
              <p className="text-[10px] text-gray-600 mt-1">60% watched, 80% aired (gray underlay)</p>
            </div>
          </SubSection>

          <SubSection title="B5. AnimeCard Hover Tooltip" note="AnimeCard.tsx:86 — single usage">
            <Row>
              <div className="px-3 py-1.5 bg-[#0b0e14]/90 border border-[#253040] rounded-lg text-xs text-gray-200 whitespace-nowrap">
                12/24 eps watched
              </div>
              <Label>Shown on card hover (opacity transition)</Label>
            </Row>
          </SubSection>

        </Section>

        {/* ━━━ GROUP C ━━━ */}

        {/* ── C1: Buttons ── */}
        <Section id="c1" title="C1. Buttons">

          <SubSection title="C1a. Primary CTA (theme)" note="7+ usages — NavBar, AddToWatchlist, etc.">
            <Row>
              <button className={`px-3 py-1.5 ${theme.btn} text-white text-sm rounded-lg font-medium transition-colors`}>
                Add to Watchlist
              </button>
              <button className={`px-5 py-2 ${theme.btn} text-white text-sm rounded-lg font-medium transition-colors`}>
                Sign in to track
              </button>
            </Row>
          </SubSection>

          <SubSection title="C1b. Secondary (dark + border)" note="5+ usages — SeriesBackfill, Settings">
            <Row>
              <button className="px-4 py-2 bg-[#141925] hover:bg-[#1c2333] text-gray-300 text-sm rounded-lg border border-[#253040] transition-colors">
                Cancel
              </button>
              <button className="px-4 py-2 bg-[#141925] hover:bg-[#1c2333] text-gray-300 text-sm rounded-lg border border-[#253040] transition-colors disabled:opacity-50" disabled>
                Disabled
              </button>
            </Row>
          </SubSection>

          <SubSection title="C1c. Icon-only" note="10+ usages — NavBar, close buttons, refresh">
            <Row>
              <button className="p-1.5 rounded transition-colors text-gray-400 hover:text-gray-200 hover:bg-[#1c2333]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
              <button className="p-1.5 rounded-lg hover:bg-[#253040] transition-colors text-gray-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <Label>Close / chevron variants</Label>
            </Row>
          </SubSection>

          <SubSection title="C1d. Status-colored" note="2 usages — AddToWatchlist">
            <Row>
              {[
                { label: 'Watching', cls: 'text-emerald-400' },
                { label: 'Planned', cls: 'text-blue-400' },
                { label: 'Completed', cls: 'text-purple-400' },
                { label: 'Dropped', cls: 'text-red-400' },
              ].map((s) => (
                <button key={s.label} className={`px-3 py-1.5 bg-[#141925] border border-[#253040] text-sm rounded-lg font-medium transition-colors hover:bg-[#1c2333] ${s.cls}`}>
                  {s.label}
                </button>
              ))}
            </Row>
          </SubSection>

          <SubSection title="C1e. Danger / amber" note="1 usage — Settings">
            <Row>
              <button className="px-4 py-2 bg-amber-700/40 hover:bg-amber-700/60 text-amber-300 text-sm rounded-lg border border-amber-700/40 font-medium">
                Disconnect AniList
              </button>
            </Row>
          </SubSection>

          <SubSection title="C1f. Filter pill (active / inactive)" note="watchlist/page.tsx:322">
            <Row>
              <div className="flex gap-2 overflow-x-auto">
                <button className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${theme.activeTab} text-white`}>
                  All <span className="text-xs opacity-60">12</span>
                </button>
                <button className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap bg-[#141925] text-gray-400 hover:text-gray-200">
                  Watching <span className="text-xs opacity-60">5</span>
                </button>
                <button className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap bg-[#141925] text-gray-400 hover:text-gray-200">
                  Completed <span className="text-xs opacity-60">3</span>
                </button>
              </div>
            </Row>
          </SubSection>

          <SubSection title="C1g. View toggle (list / card)" note="watchlist/page.tsx:298">
            <Row>
              <div className="flex gap-1 bg-[#141925] rounded-lg p-0.5 border border-[#253040]">
                <button className={`p-1.5 rounded transition-colors ${theme.activeTab} text-white`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                </button>
                <button className="p-1.5 rounded transition-colors text-gray-500 hover:text-gray-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                </button>
              </div>
            </Row>
          </SubSection>

          <SubSection title="C1h. Pagination" note="watchlist/page.tsx:515">
            <Row>
              <button className="px-3 py-1.5 text-sm bg-[#141925] border border-[#253040] rounded-lg text-gray-400 hover:text-gray-200 transition-colors">
                Prev
              </button>
              <span className="text-sm text-gray-500">Page 1 of 3</span>
              <button className="px-3 py-1.5 text-sm bg-[#141925] border border-[#253040] rounded-lg text-gray-400 hover:text-gray-200 transition-colors">
                Next
              </button>
              <button className="px-3 py-1.5 text-sm bg-[#141925] border border-[#253040] rounded-lg text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled>
                Disabled
              </button>
            </Row>
          </SubSection>

        </Section>

        {/* ── C2: Cards / Panels ── */}
        <Section id="c2" title="C2. Cards / Panels">

          <SubSection title="C2a. Anime list card (horizontal)" note="AnimeCard.tsx:48 — 5+ pages">
            <div className="max-w-lg">
              <div className="group/card flex gap-3 bg-[#141925] rounded-lg p-3 relative cursor-pointer hover:bg-[#1c2333] transition-colors">
                <div className="w-[48px] h-[68px] bg-[#253040] rounded flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">Attack on Titan</p>
                  <p className="text-xs text-gray-500 mt-0.5">25 episodes</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="px-1.5 py-0.5 rounded font-semibold uppercase text-[9px] bg-emerald-900 text-emerald-300">Releasing</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1e2736] rounded-full overflow-hidden mt-2">
                    <div className={`h-full rounded-full ${theme.activeTab}`} style={{ width: '48%' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="max-w-lg mt-2">
              <div className="flex gap-3 bg-[#141925] rounded-lg p-3 relative border border-red-500/40">
                <div className="w-[48px] h-[68px] bg-[#253040] rounded flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">NSFW variant (red border)</p>
                  <p className="text-xs text-gray-500 mt-0.5">12 episodes</p>
                </div>
              </div>
            </div>
          </SubSection>

          <SubSection title="C2b. Dark info panel" note="settings/page.tsx:147 — 5+ usages">
            <div className="max-w-lg bg-[#0b0e14] border border-[#253040] rounded-lg p-3">
              <p className="text-xs text-gray-400 font-mono">Connected as: user@example.com</p>
              <p className="text-xs text-gray-400 font-mono mt-1">AniList ID: 123456</p>
            </div>
          </SubSection>

          <SubSection title="C2c. Stat card (gradient, animated counter)" note="stats/page.tsx:93 — counter animates in production">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
              {[
                { label: 'Total Users', value: '142', accent: 'from-teal-500/20 to-teal-500/5 border-teal-500/20' },
                { label: 'Active Today', value: '23', accent: 'from-rose-500/20 to-rose-500/5 border-rose-500/20' },
                { label: 'Episodes', value: '8,431', accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20' },
              ].map((s) => (
                <div key={s.label} className={`relative overflow-hidden rounded-xl border bg-gradient-to-br backdrop-blur-sm p-5 ${s.accent}`}>
                  <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="C2d. Franchise entry card (timeline)" note="FranchiseTabs.tsx:164 — 1 usage">
            <div className="flex gap-2.5 rounded-lg p-2 border-2 max-w-[520px]" style={{ borderColor: sfwMode ? '#0d9488' : '#e11d48' }}>
              <div className="w-[40px] h-[56px] bg-[#253040] rounded flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">Season 1</p>
                <p className="text-[10px] text-gray-500">25 eps</p>
              </div>
            </div>
            <div className="flex gap-2.5 rounded-lg p-2 border border-[#253040] bg-[#141925] opacity-75 max-w-[520px] mt-2">
              <div className="w-[40px] h-[56px] bg-[#253040] rounded flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">Season 2 (inactive)</p>
                <p className="text-[10px] text-gray-500">12 eps</p>
              </div>
            </div>
          </SubSection>

          <SubSection title="C2e. Anime grid card" note="watchlist card view, search, airing, profile, franchise, playlists — 7 locations">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl">
              {/* Standard grid card */}
              <div className="bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors group/card relative">
                <div className="relative w-full aspect-[3/4] bg-[#253040]">
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <StatusBadge tone="emerald">Releasing</StatusBadge>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-200 truncate">Standard card</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">12/24 eps</p>
                </div>
              </div>

              {/* NSFW variant */}
              <div className="bg-[#141925] rounded-lg overflow-hidden border border-red-500/40">
                <div className="relative w-full aspect-[3/4] bg-[#253040]" />
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-200 truncate">NSFW border</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">12 eps</p>
                </div>
              </div>

              {/* Airing variant with track button */}
              <div className="bg-[#141925] rounded-lg overflow-hidden group relative">
                <div className="relative w-full aspect-[3/4] bg-[#253040]">
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <span className="text-xs font-bold text-white">Ep 5</span>
                  </div>
                  <button className={`absolute top-1.5 right-1.5 px-2 py-1 rounded text-[10px] font-semibold ${theme.activeTab} text-white opacity-90`}>
                    + Track
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-200 truncate">Airing variant</p>
                  <p className={`text-[10px] ${theme.btnText} mt-0.5`}>14:30</p>
                </div>
              </div>

              {/* Franchise relation variant */}
              <div className="bg-[#141925] rounded-lg overflow-hidden">
                <div className="relative w-full aspect-[3/4] bg-[#253040]">
                  <div className="absolute top-1 left-1">
                    <span className="px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-gray-300 font-medium">Spin-off</span>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-200 truncate">Relation badge</p>
                </div>
              </div>
            </div>
          </SubSection>

          <SubSection title="C2f. Folder card 2x2 mosaic" note="watchlist/page.tsx:417,513 — series grouping, list + card view">
            <div className="flex gap-6 items-start max-w-xl">
              {/* List view folder */}
              <div>
                <p className="text-[10px] text-gray-600 mb-2">List view</p>
                <div className="flex items-center gap-3 bg-[#141925] rounded-lg p-3 border border-[#253040]/50 hover:bg-[#1c2333] transition-colors cursor-pointer w-64">
                  <div className="grid grid-cols-2 gap-[2px] w-14 flex-shrink-0 aspect-[3/4] rounded overflow-hidden bg-[#0b0e14]">
                    <div className="bg-[#253040]" />
                    <div className="bg-[#253040]" />
                    <div className="bg-[#253040]" />
                    <div className="bg-[#1c2333]" />
                  </div>
                  <div className="flex flex-col justify-center gap-1 flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-200 truncate">Attack on Titan</p>
                    <p className="text-xs text-gray-500">3 entries</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 flex-shrink-0"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              </div>

              {/* Card view folder */}
              <div>
                <p className="text-[10px] text-gray-600 mb-2">Card view</p>
                <div className="bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors border border-[#253040]/50 w-36">
                  <div className="relative aspect-[3/4]">
                    <div className="absolute inset-0 grid grid-cols-2 gap-[2px] bg-[#0b0e14]">
                      <div className="bg-[#253040]" />
                      <div className="bg-[#253040]" />
                      <div className="bg-[#253040]" />
                      <div className="bg-[#1c2333]" />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-2 flex items-end">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-[#253040] text-gray-300">3 entries</span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate">Attack on Titan</p>
                  </div>
                </div>
              </div>

              {/* Card view folder (all filled) */}
              <div>
                <p className="text-[10px] text-gray-600 mb-2">Card (all filled)</p>
                <div className="bg-[#141925] rounded-lg overflow-hidden cursor-pointer hover:bg-[#1c2333] transition-colors border border-[#253040]/50 w-36">
                  <div className="relative aspect-[3/4]">
                    <div className="absolute inset-0 grid grid-cols-2 gap-[2px] bg-[#0b0e14]">
                      <div className="bg-[#253040]" />
                      <div className="bg-[#253040]" />
                      <div className="bg-[#253040]" />
                      <div className="bg-[#253040]" />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-2 flex items-end">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-[#253040] text-gray-300">4 entries</span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate">Naruto</p>
                  </div>
                </div>
              </div>
            </div>
          </SubSection>

        </Section>

        {/* ── C3: Dropdowns ── */}
        <Section id="c3" title="C3. Dropdowns">

          <SubSection title="C3a. Watchlist status dropdown" note="AddToWatchlist.tsx:152 — 2 usages">
            <div className="relative inline-block">
              <div className="w-40 bg-[#141925] border border-[#253040] rounded-lg shadow-xl overflow-hidden">
                {['Watching', 'Planned', 'Completed', 'On Hold', 'Dropped'].map((s) => (
                  <button key={s} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#1c2333] transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </SubSection>

          <SubSection title="C3b. Playlist dropdown" note="AddToPlaylist.tsx:116 — fixed positioned">
            <div className="relative inline-block">
              <div className="w-56 bg-[#141925] border border-[#253040] rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-[#253040]">
                  <p className="text-xs font-medium text-gray-400">Add to playlist</p>
                </div>
                {['My Favorites', 'Watch Later', 'Sci-Fi Picks'].map((p, i) => (
                  <button key={p} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1c2333] transition-colors">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${i === 0 ? `${theme.activeTab} border-${theme.accent}-600` : 'border-[#253040]'}`}>
                      {i === 0 && <span className="text-white text-[10px]">&#10003;</span>}
                    </span>
                    <span className="text-sm text-gray-300">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          </SubSection>

          <SubSection title="C3c. Prequels dropdown" note="AddPrequels.tsx:207">
            <div className="relative inline-block">
              <div className="w-40 bg-[#141925] border border-[#253040] rounded-lg shadow-xl overflow-hidden">
                <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#1c2333] transition-colors">Add as Watching</button>
                <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#1c2333] transition-colors">Add as Completed</button>
              </div>
            </div>
          </SubSection>

          <SubSection title="C3d. Right-click context menu" note="watchlist/page.tsx:603">
            <div className="relative inline-block">
              <div className="bg-[#141925] border border-[#253040] rounded-lg shadow-xl py-1 min-w-[160px]">
                <p className="px-3 py-1.5 text-xs text-gray-500 truncate max-w-[200px]">Attack on Titan</p>
                <div className="border-t border-[#253040] my-1" />
                <button className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-[#1c2333] transition-colors">View Details</button>
                <button className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-[#1c2333] transition-colors">Change Status</button>
                <div className="border-t border-[#253040] my-1" />
                <button className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-[#1c2333] transition-colors">Remove</button>
              </div>
            </div>
          </SubSection>

          <SubSection title="C3e. Sort dropdown (provider-aware)" note="components/search/SortDropdown.tsx — amber indicator for unsupported sorts">
            <Row>
              <Label>Default</Label>
              <button className="px-2 py-1 text-xs bg-[#141925] border border-[#253040] rounded-lg text-gray-400 flex items-center gap-1">
                Sort: Popularity <span className="text-[10px] text-gray-600">(default)</span> <span className="text-gray-600">&#9662;</span>
              </button>
            </Row>
            <Row>
              <Label>Not applied</Label>
              <button className="px-2 py-1 text-xs bg-[#141925] border border-[#253040] rounded-lg text-gray-400 flex items-center gap-1.5">
                Sort: Score <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> <span className="text-gray-600">&#9662;</span>
              </button>
            </Row>
            <Row>
              <Label>Open</Label>
              <div className="relative inline-block">
                <button className="px-2 py-1 text-xs bg-[#141925] border border-[#253040] rounded-lg text-gray-400 flex items-center gap-1">
                  Sort: Popularity <span className="text-gray-600">&#9662;</span>
                </button>
                <div className="absolute top-8 left-0 w-52 bg-[#141925] border border-[#253040] rounded-lg py-1 shadow-xl z-10">
                  <button className="w-full text-left px-3 py-1.5 text-xs text-gray-300 bg-[#1c2333] flex justify-between items-center">Popularity &#10003;</button>
                  <button className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1c2333]">Score</button>
                  <button className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1c2333] flex justify-between items-center">Trending <span className="text-amber-500 text-[10px]">not applied</span></button>
                  <button className="w-full text-left px-3 py-1.5 text-xs text-gray-500 opacity-40 cursor-not-allowed">Relevance</button>
                </div>
              </div>
            </Row>
          </SubSection>

          <SubSection title="C3f. Genre multi-select (provider-aware)" note="components/search/GenreSelect.tsx — chips + disabled items on Jikan">
            <Row>
              <Label>With chips</Label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>Action <span className="opacity-60 cursor-pointer">&times;</span></span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>Comedy <span className="opacity-60 cursor-pointer">&times;</span></span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-gray-600 bg-transparent text-gray-500 opacity-40 line-through">Mahou Shoujo <span className="cursor-pointer">&times;</span></span>
                </div>
                <button className="text-xs text-gray-400 border border-[#253040] rounded-lg px-3 py-1 bg-[#0b0e14]">Add more...</button>
              </div>
            </Row>
            <Row>
              <Label>Empty</Label>
              <button className="text-xs text-gray-400 border border-[#253040] rounded-lg px-3 py-1 bg-[#0b0e14]">Select genres...</button>
            </Row>
          </SubSection>

          <SubSection title="C3g. Tag multi-select (searchable)" note="components/search/TagSelect.tsx — search + category label + SFW filtering">
            <Row>
              <Label>With chips</Label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>Isekai <span className="opacity-60 cursor-pointer">&times;</span></span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>Time Skip <span className="opacity-60 cursor-pointer">&times;</span></span>
                </div>
                <button className="text-xs text-gray-400 border border-[#253040] rounded-lg px-3 py-1 bg-[#0b0e14]">Add more...</button>
              </div>
            </Row>
            <Row>
              <Label>Open dropdown</Label>
              <div className="relative inline-block">
                <div className="w-56 bg-[#141925] border border-[#253040] rounded-lg shadow-xl">
                  <div className="p-2 border-b border-[#253040]">
                    <input type="text" placeholder="Search tags..." className="w-full text-xs bg-[#0b0e14] border border-[#253040] rounded px-2 py-1 text-gray-300" readOnly />
                  </div>
                  <div className="py-1 max-h-32 overflow-y-auto">
                    <button className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1c2333] flex justify-between">Isekai <span className="text-gray-500">Setting</span></button>
                    <button className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1c2333] flex justify-between">Time Skip <span className="text-gray-500">Theme</span></button>
                    <button className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1c2333] flex justify-between">Revenge <span className="text-gray-500">Theme</span></button>
                  </div>
                </div>
              </div>
            </Row>
          </SubSection>

          <SubSection title="C3h. Studio multi-select (debounced search)" note="components/search/StudioSelect.tsx — API search + cached results">
            <Row>
              <Label>With chip</Label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>MAPPA <span className="opacity-60 cursor-pointer">&times;</span></span>
                </div>
                <button className="text-xs text-gray-400 border border-[#253040] rounded-lg px-3 py-1 bg-[#0b0e14]">Add more...</button>
              </div>
            </Row>
            <Row>
              <Label>Search states</Label>
              <div className="flex gap-4">
                <div className="w-52 bg-[#141925] border border-[#253040] rounded-lg shadow-xl">
                  <div className="p-2 border-b border-[#253040]">
                    <input type="text" placeholder="Search studios..." className="w-full text-xs bg-[#0b0e14] border border-[#253040] rounded px-2 py-1 text-gray-300" readOnly />
                  </div>
                  <p className="px-3 py-2 text-xs text-gray-500">Type at least 2 characters</p>
                </div>
                <div className="w-52 bg-[#141925] border border-[#253040] rounded-lg shadow-xl">
                  <div className="p-2 border-b border-[#253040]">
                    <input type="text" defaultValue="MA" className="w-full text-xs bg-[#0b0e14] border border-[#253040] rounded px-2 py-1 text-gray-300" readOnly />
                  </div>
                  <p className="px-3 py-2 text-xs text-gray-400">Searching...</p>
                </div>
              </div>
            </Row>
          </SubSection>

        </Section>

        {/* ── C4: Toggles ── */}
        <Section id="c4" title="C4. Toggles">

          <SubSection title="C4a. SFW toggle switch" note="SfwToggle.tsx:14 — 3+ usages">
            <Row>
              <Label>SFW on</Label>
              <button onClick={() => setSfwToggleDemo(!sfwToggleDemo)} className="flex items-center gap-1.5 select-none">
                <span className={`text-[11px] font-bold transition-colors ${sfwToggleDemo ? 'text-emerald-400' : 'text-gray-600'}`}>SFW</span>
                <div className={`relative w-10 h-5 rounded-full transition-colors ${sfwToggleDemo ? 'bg-emerald-600' : 'bg-red-600'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${sfwToggleDemo ? '' : 'translate-x-5'}`} />
                </div>
                <span className={`text-[11px] font-bold transition-colors ${sfwToggleDemo ? 'text-gray-600' : 'text-red-400'}`}>NSFW</span>
              </button>
              <Label>(click to toggle)</Label>
            </Row>
          </SubSection>

          <SubSection title="C4b. Playlist checkbox" note="AddToPlaylist.tsx:143">
            <Row>
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${theme.activeTab} border-${theme.accent}-600`}>
                <span className="text-white text-[10px]">&#10003;</span>
              </span>
              <Label>Checked</Label>
              <span className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 border-[#253040]" />
              <Label>Unchecked</Label>
            </Row>
          </SubSection>

        </Section>

        {/* ── C5: Tabs ── */}
        <Section id="c5" title="C5. Tabs">

          <SubSection title="C5a. Bottom-border tabs" note="FranchiseTabs.tsx:684">
            <div className="border-b border-[#253040] flex">
              {['Watch Order', 'Related', 'Details'].map((tab, i) => (
                <button
                  key={tab}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px inline-flex items-center ${i === 0
                      ? `border-${theme.accent}-500 ${theme.btnText}`
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </SubSection>

        </Section>

        {/* ── C6: Badges ── */}
        <Section id="c6" title="C6. Badges (non-StatusBadge)">

          <SubSection title="C6a. Notification count (red circle)" note="NavBar.tsx:130 — 2 usages">
            <Row>
              <div className="relative inline-block">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">3</span>
              </div>
              <Label>With count</Label>
            </Row>
          </SubSection>

          <SubSection title='C6b. "New" pill (theme)' note="notifications/page.tsx:133">
            <Row>
              <span className={`px-2 py-0.5 ${theme.activeTab} text-white text-xs font-semibold rounded-full`}>2 new</span>
            </Row>
          </SubSection>

          <SubSection title="C6c. Relation type label" note="FranchiseTabs.tsx:194">
            <Row>
              {['Sequel', 'Prequel', 'Spin-off', 'Recap'].map((r) => (
                <span key={r} className="px-1 py-0.5 rounded text-[9px] bg-[#253040] text-gray-400 font-medium flex-shrink-0">{r}</span>
              ))}
            </Row>
          </SubSection>

          <SubSection title="C6d. Founding member badge (circular)" note="BadgeSlots.tsx:30 — amber border, hover tooltip">
            <Row>
              <div className="group/badge relative">
                <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-amber-500/60 cursor-default">
                  <Image src="/badges/founding_member.png" alt="Founding Member" width={28} height={28} className="w-full h-full object-cover" unoptimized />
                </div>
              </div>
              <Label>Badge slot (w-7 h-7)</Label>
              <div className="bg-[#0b0e14] border border-[#253040] rounded-full flex items-stretch place-items-center w-max">
                <div className='flex min-w-[80px] min-h-[80px] justify-center'>
                  <Image src="/badges/founding_member.png" alt="Founding Member" width={60} height={80} className="p-2 h-20 object-cover flex-shrink-0 w-max" style={{ borderRadius: '11px 0 0 11px' }} unoptimized />
                </div>
                <div className="pr-3 py-2.5 flex flex-col justify-center w-36">
                  <p className="text-[11px] font-semibold text-amber-300 leading-tight">Founding Member</p>
                  <p className="text-[10px] text-gray-400 mt-1 leading-snug">Joined during early access</p>
                </div>
              </div>
              <Label>Hover tooltip</Label>
            </Row>
          </SubSection>

          <SubSection title="C6e. SearchBar filter badge (active count)" note="SearchBar.tsx:91 — theme-colored count overlay on filter icon">
            <Row>
              <Label>No filters</Label>
              <div className="relative p-1.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-500">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
                </svg>
              </div>
            </Row>
            <Row>
              <Label>SFW (teal)</Label>
              <div className="relative p-1.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-teal-400">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
                </svg>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">3</span>
              </div>
            </Row>
            <Row>
              <Label>NSFW (rose)</Label>
              <div className="relative p-1.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-rose-400">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
                </svg>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">5</span>
              </div>
            </Row>
          </SubSection>

        </Section>

        {/* ── C7: Navigation ── */}
        <Section id="c7" title="C7. Navigation">

          <SubSection title="C7a. Desktop nav link" note="NavBar.tsx:101">
            <Row>
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${theme.activeTab} text-white`}>Watchlist</span>
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors cursor-pointer">Search</span>
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1c2333] transition-colors cursor-pointer">Airing</span>
            </Row>
          </SubSection>

          <SubSection title="C7b. Mobile tab bar item" note="NavBar.tsx:178 — actual icons from NavBar">
            <div className="flex bg-[#141925]/60 backdrop-blur-xl border-t border-white/5 rounded-lg overflow-hidden max-w-sm h-14 items-center justify-around px-2">
              <div className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg ${theme.btnText}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                <span className="text-[10px] font-medium">Watchlist</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg text-gray-500">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <span className="text-[10px] font-medium">Search</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg text-gray-500">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                <span className="text-[10px] font-medium">Airing</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg text-gray-500">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                <span className="text-[10px] font-medium">More</span>
              </div>
            </div>
          </SubSection>

          <SubSection title="C7c. More menu item" note="NavBar.tsx:242 — text/emoji icons, not SVGs">
            <div className="max-w-xs space-y-1">
              <div className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${theme.activeTab} text-white`}>
                <span className="w-5 text-center text-gray-500">✦</span>
                For You
              </div>
              <div className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-300 hover:bg-[#1c2333] cursor-pointer">
                <span className="w-5 text-center text-gray-500">▶</span>
                Playlists
              </div>
              <div className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-300 hover:bg-[#1c2333] cursor-pointer">
                <span className="w-5 text-center text-gray-500">⚙</span>
                Settings
              </div>
            </div>
          </SubSection>

          <SubSection title="C7d. Header strip (search results toolbar)" note="components/search/HeaderStrip.tsx — provider label + sort + view toggle">
            <div className="flex items-center gap-3 max-w-xl">
              <span className="text-xs text-gray-500">Results from</span>
              <span className={`text-xs font-medium ${theme.btnText}`}>AniList</span>
              <button className="ml-auto px-2 py-1 text-xs bg-[#141925] border border-[#253040] rounded-lg text-gray-400 flex items-center gap-1">
                Sort: Popularity <span className="text-gray-600">&#9662;</span>
              </button>
              <div className="flex gap-1">
                <button className={`p-1.5 rounded transition-colors ${theme.activeTab} text-white`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
                </button>
                <button className="p-1.5 rounded transition-colors text-gray-500 hover:text-gray-300">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                </button>
              </div>
            </div>
          </SubSection>

        </Section>

        {/* ── C8: Gradient Text ── */}
        <Section id="c8" title="C8. Gradient Text">

          <SubSection title="C8a. Brand logo gradient" note="NavBar.tsx:92 — 3+ usages">
            <Row>
              <span className={`text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient}`}>
                AniTracker
              </span>
              <span className={`text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient}`}>
                AniTracker (sm)
              </span>
            </Row>
          </SubSection>

        </Section>

        {/* ── C9: Banners ── */}
        <Section id="c9" title="C9. Banners">

          <SubSection title="C9a. Founding member banner (amber gradient)" note="FoundingMemberBanner.tsx:84">
            <div className="relative bg-gradient-to-r from-amber-900/30 to-yellow-900/20 border border-amber-700/30 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-600/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-amber-300">001</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-200">You&apos;re a Founding Member!</p>
                <p className="text-xs text-amber-400/70 mt-0.5">Badge #001 — Joined during early access</p>
              </div>
              <button className="text-amber-500/50 hover:text-amber-400 transition-colors text-sm">x</button>
            </div>
          </SubSection>

          <SubSection title="C9b. Provider status banner (amber, full-width)" note="ProviderStatusBanner.tsx:25">
            <div className="bg-amber-900/30 border-b border-amber-500/30 px-4 py-2 flex items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300">AniList</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300">Jikan</span>
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300">Kitsu</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            </div>
          </SubSection>

          <SubSection title="C9c. Streaming banner (dismissable)" note="components/StreamingBanner.tsx — lazy-loaded info banner">
            <div className="bg-[#141925] border border-[#253040] rounded-lg px-4 py-3 flex items-start gap-3 max-w-xl">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-500 mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <p className="flex-1 text-sm text-gray-300">
                <span>3 watching, 2 planned on </span>
                <span className="text-gray-100 font-medium">Crunchyroll</span>
                <span className="text-gray-600"> &middot; </span>
                <span>1 watching on </span>
                <span className="text-gray-100 font-medium">Funimation</span>
              </p>
              <button className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </SubSection>

        </Section>

        {/* ── C10: Loaders ── */}
        <Section id="c10" title="C10. Loaders (non-Spinner)">

          <SubSection title="C10a. Pulsing dot" note="FranchiseTabs.tsx:692">
            <Row>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <Label>Computing indicator</Label>
            </Row>
          </SubSection>

          <SubSection title="C10b. Skeleton placeholder" note="FranchiseTabs.tsx:205">
            <Row>
              <div className="h-3 w-12 rounded bg-[#253040] animate-pulse" />
              <div className="h-3 w-20 rounded bg-[#253040] animate-pulse" />
              <div className="h-3 w-8 rounded bg-[#253040] animate-pulse" />
              <Label>Text skeleton bars</Label>
            </Row>
          </SubSection>

          <SubSection title="C10c. Ping dot (live indicator)" note="stats/page.tsx:136">
            <Row>
              <div className="relative">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full inline-block" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              </div>
              <Label>Live/online ping</Label>
            </Row>
          </SubSection>

        </Section>

        {/* ── C11: Inputs ── */}
        <Section id="c11" title="C11. Inputs (non-extracted)">

          <SubSection title="C11a. Episode batch select" note="EpisodeGrid.tsx:51 — <select> element, structurally different from text inputs">
            <Row>
              <select className="bg-[#0b0e14] border border-[#253040] rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-gray-500">
                <option>Eps 1-100</option>
                <option>Eps 101-200</option>
                <option>Eps 201-300</option>
              </select>
            </Row>
          </SubSection>

        </Section>

        {/* ── C12: Empty States ── */}
        <Section id="c12" title="C12. Empty States">

          <SubSection title="C12a. Watchlist" note="watchlist/page.tsx:358">
            <div className="bg-[#141925] rounded-lg p-8">
              <p className="text-gray-500 text-center">No anime tracked yet.</p>
            </div>
            <div className="bg-[#141925] rounded-lg p-8 mt-2">
              <p className="text-gray-500 text-center">No anime matching these filters</p>
            </div>
          </SubSection>

          <SubSection title="C12b. Search" note="search/page.tsx:152">
            <div className="bg-[#141925] rounded-lg p-8">
              <p className="text-gray-500 text-center">No results found.</p>
            </div>
          </SubSection>

          <SubSection title="C12c. Notifications" note="notifications/page.tsx:161 — two-line variant">
            <div className="bg-[#141925] rounded-lg p-8 text-center text-gray-500">
              <p>No notifications yet.</p>
              <p className="mt-1 text-sm">Episode alerts and sequel announcements will appear here.</p>
            </div>
          </SubSection>

          <SubSection title="C12d. Buddies" note="buddies/page.tsx:247">
            <div className="bg-[#141925] rounded-lg p-8">
              <p className="text-gray-500 text-sm text-center">No buddies yet. Search for friends to start sharing recommendations!</p>
            </div>
          </SubSection>

          <SubSection title="C12e. Playlists" note="playlists/page.tsx:158">
            <div className="bg-[#141925] rounded-lg p-8">
              <p className="text-gray-500 text-center">No playlists yet. Create one above!</p>
            </div>
          </SubSection>

          <SubSection title="C12f. Recommendations (no matches)" note="recommend/page.tsx:203 — with retry button">
            <div className="bg-[#141925] rounded-lg p-8 text-center">
              <p className="text-gray-500 mb-4">No matches found. Try different preferences!</p>
              <button className={`px-4 py-2 rounded-lg text-sm font-medium ${theme.activeTab} text-white`}>
                Retry
              </button>
            </div>
          </SubSection>

          <SubSection title="C12g. Recommendations (insufficient data)" note="recommend/page.tsx:106 — heading + CTA">
            <div className="bg-[#141925] rounded-lg p-8 text-center">
              <h1 className="text-xl font-bold text-gray-200 mb-3">Not Enough Data Yet</h1>
              <p className="text-gray-500 text-sm mb-4">Complete at least 3 anime so we can learn your taste.</p>
              <button className={`px-4 py-2 rounded-lg text-sm font-medium ${theme.activeTab} text-white`}>
                Browse Anime
              </button>
            </div>
          </SubSection>

        </Section>

        {/* ── C13: Error States ── */}
        <Section id="c13" title="C13. Error States">

          <SubSection title="C13a. Anime not found" note="anime/[id]/page.tsx:333">
            <div className="bg-[#141925] rounded-lg p-8">
              <p className="text-gray-500 text-center">Anime not found.</p>
            </div>
          </SubSection>

          <SubSection title="C13b. Stats failed" note="stats/page.tsx:508 — red heading + detail + retry">
            <div className="bg-[#141925] rounded-lg p-8 text-center">
              <p className="text-red-400 mb-2">Failed to load analytics</p>
              <p className="text-gray-500 text-sm">Network error: could not reach server</p>
              <button className={`mt-4 text-sm ${theme.link}`}>Retry</button>
            </div>
          </SubSection>

          <SubSection title="C13c. Auth error (inline)" note="login/signup/reset — text-red-400 text-sm">
            <div className="max-w-xs space-y-2">
              <p className="text-red-400 text-sm">Invalid login credentials</p>
              <p className="text-red-400 text-sm">Password must be at least 6 characters</p>
            </div>
          </SubSection>

          <SubSection title="C13d-g. Full-page error states" note="profile-client.tsx, playlists/[slug] — centered with teal link">
            {[
              { text: 'Profile not found.', link: 'Go home' },
              { text: 'This profile is private.', link: 'Go home' },
              { text: 'Set up your profile first.', link: 'Go to Settings' },
              { text: 'Playlist not found', link: 'Sign in to create your own playlists' },
            ].map((e) => (
              <div key={e.text} className="bg-[#141925] rounded-lg p-6 mb-2 flex flex-col items-center gap-2">
                <p className="text-gray-400">{e.text}</p>
                <span className="text-teal-400 text-sm hover:text-teal-300 cursor-pointer">{e.link}</span>
              </div>
            ))}
          </SubSection>

        </Section>

        {/* ── C14: Toast ── */}
        <Section id="c14" title="C14. Toast / Snackbar">

          <SubSection title="C14a. Notistack toast (custom themed)" note="SnackbarProvider.tsx — 54 call sites, 3 variants">
            <div className="space-y-3 max-w-sm">
              {[
                { variant: 'success', icon: '&#10003;', color: 'text-emerald-400', message: 'Added to watchlist as Watching' },
                { variant: 'error', icon: '&#10007;', color: 'text-red-400', message: 'Failed to update watchlist' },
                { variant: 'info', icon: 'i', color: 'text-blue-400', message: 'Already in your watchlist' },
              ].map((t) => (
                <div
                  key={t.variant}
                  style={{
                    backgroundColor: '#141925',
                    border: '1px solid #253040',
                    color: '#e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                  className="px-4 py-3 flex items-center gap-3"
                >
                  <span className={`${t.color} font-bold text-sm`} dangerouslySetInnerHTML={{ __html: t.icon }} />
                  <span>{t.message}</span>
                  <span className="text-[10px] text-gray-600 ml-auto">{t.variant}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-2">Bottom-left anchored, 3s auto-hide, max 3 visible</p>
          </SubSection>

        </Section>

        {/* ── C15: Profile Header Hero ── */}
        <Section id="c15" title="C15. Profile Header Hero">

          <SubSection title="C15a. Profile hero" note="profile-client.tsx:222 — avatar, name, social, badges, stat grid">
            <div className="bg-[#141925] rounded-lg p-8">
              <div className="text-center">
                {/* Image avatar state */}
                <p className="text-[10px] text-gray-600 mb-2">Image avatar</p>
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#253040] mx-auto mb-2 bg-[#253040]" />

                {/* Gradient fallback avatar state */}
                <p className="text-[10px] text-gray-600 mb-2 mt-4">Gradient fallback avatar</p>
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${theme.gradientBold} mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-white`}>
                  S
                </div>

                <h1 className="text-2xl font-bold text-gray-100">samriddha</h1>
                <p className="text-sm text-gray-500 mt-1">Member since Jan 2025</p>

                <div className="flex items-center justify-center gap-3 mt-3">
                  {['Twitter', 'Discord', 'Instagram'].map((s) => (
                    <span key={s} className="text-gray-500 hover:text-gray-300 text-xs cursor-pointer">{s}</span>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-1.5 flex-wrap mt-3">
                  <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-amber-500/60 bg-amber-600/30 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-amber-300">001</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-8">
                {[
                  { label: 'Total Anime', value: '47' },
                  { label: 'Watching', value: '8' },
                  { label: 'Completed', value: '32' },
                  { label: 'Planned', value: '5' },
                  { label: 'Dropped', value: '2' },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border bg-gradient-to-br p-3 text-center ${theme.gradient.split(' ').map((c: string) => c.includes('from-') || c.includes('to-') ? c.replace(/400/g, '500/10') : c).join(' ')} border-${theme.accent}-500/20`}>
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-lg font-bold text-gray-100">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </SubSection>

        </Section>

        {/* ── C16: Anime Detail Hero ── */}
        <Section id="c16" title="C16. Anime Detail Hero">

          <SubSection title="C16a. Anime detail hero" note="anime/[id]/page.tsx:347 — blurred backdrop, cover, metadata, genre chips">
            <div className="relative bg-[#141925] rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-900/20 to-blue-900/10 blur-3xl scale-110 opacity-30" />
              <div className="relative px-6 pt-8 pb-6">
                <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                  <div className="w-[120px] h-[170px] sm:w-[160px] sm:h-[230px] flex-shrink-0 bg-[#253040] rounded-lg shadow-lg" />
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-100 mb-1">Attack on Titan</h1>
                    <p className="text-sm text-gray-500 mb-3">&#36914;&#25731;&#12398;&#24040;&#20154;</p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase bg-blue-900 text-blue-300">Finished</span>
                      <span className="text-sm text-yellow-400 font-semibold">&#9733; 8.5</span>
                      <span className="text-sm text-gray-400">Wit Studio</span>
                    </div>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-1 text-sm text-gray-400 mb-4">
                      <span>25 episodes</span>
                      <span>24 min/ep</span>
                      <span>Spring 2013</span>
                    </div>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <button className={`px-3 py-1.5 ${theme.btn} text-white text-sm rounded-lg font-medium`}>Add to Watchlist</button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 bg-[#141925] border border-[#253040] rounded-lg p-4 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${theme.pulse} animate-pulse`} />
                  <span className="text-sm text-gray-300">
                    Episode 5 airing in <span className={`${theme.btnText} font-semibold`}>2d 14h</span>
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {['Action', 'Drama', 'Fantasy', 'Military'].map((g) => (
                    <span key={g} className="px-3 py-1 bg-[#111827] border border-[#253040] rounded-full text-xs text-gray-300">{g}</span>
                  ))}
                </div>
              </div>
            </div>
          </SubSection>

        </Section>

        {/* ── C17: Stats Visualizations ── */}
        <Section id="c17" title="C17. Stats Page Visualizations">

          <SubSection title="C17a-c. Chart containers (line, bar, pie)" note="stats/page.tsx — Recharts, not renderable without data">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {['Line Chart (Active Users)', 'Bar Chart (Signups)', 'Pie Chart (Status Distribution)', 'Line Chart (Watch Order Usage)'].map((title) => (
                <div key={title} className="bg-[#141925] border border-[#253040] rounded-xl p-5">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">{title}</h3>
                  <div className="h-[200px] flex items-center justify-center text-gray-600 text-xs border border-dashed border-[#253040] rounded">
                    Recharts {title.split(' ')[0].toLowerCase()} chart renders here
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-2">
              Tooltip style: bg #0b0e14, border #253040, radius 8. Line/bar fill: #22d3ee (cyan). Grid: #253040. Axis: #9ca3af at 10px.
            </p>
          </SubSection>

          <SubSection title="C17d. Chart container panel" note="stats/page.tsx — shared wrapper for all charts">
            <div className="bg-[#141925] border border-[#253040] rounded-xl p-5 max-w-sm">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Chart Title</h3>
              <div className="h-12 flex items-center justify-center text-gray-600 text-xs">content area</div>
            </div>
          </SubSection>

          <SubSection title="C17e. Retention cohort table" note="stats/page.tsx:211 — color-coded intensity cells">
            <div className="bg-[#141925] border border-[#253040] rounded-xl p-5 max-w-md">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Retention Cohort</h3>
              <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                <span className="text-gray-500">Week</span><span className="text-gray-500">W1</span><span className="text-gray-500">W2</span><span className="text-gray-500">W3</span>
                <span className="text-gray-400">Jan</span>
                <span className="bg-teal-600/40 rounded px-1 py-0.5 text-gray-200">80%</span>
                <span className="bg-teal-600/20 rounded px-1 py-0.5 text-gray-300">45%</span>
                <span className="bg-teal-600/10 rounded px-1 py-0.5 text-gray-400">22%</span>
              </div>
            </div>
          </SubSection>

          <SubSection title="C17f. Feature adoption bars" note="stats/page.tsx:262 — horizontal teal fill">
            <div className="bg-[#141925] border border-[#253040] rounded-xl p-5 max-w-sm">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Feature Adoption</h3>
              {[
                { label: 'Watchlist', pct: 95 },
                { label: 'Playlists', pct: 42 },
                { label: 'Buddies', pct: 28 },
              ].map((f) => (
                <div key={f.label} className="mb-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                    <span>{f.label}</span><span>{f.pct}%</span>
                  </div>
                  <div className="h-2 bg-[#1e2736] rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="C17g. Growth funnel" note="stats/page.tsx:290 — horizontal stacked bars, conversion rates">
            <div className="bg-[#141925] border border-[#253040] rounded-xl p-5 max-w-sm">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Growth Funnel</h3>
              {[
                { label: 'Signed up', value: 142, pct: 100 },
                { label: 'Added 1+ anime', value: 98, pct: 69 },
                { label: 'Active this week', value: 23, pct: 16 },
              ].map((f) => (
                <div key={f.label} className="mb-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                    <span>{f.label}</span><span>{f.value} ({f.pct}%)</span>
                  </div>
                  <div className="h-3 bg-[#1e2736] rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500/60 rounded-full" style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </SubSection>

        </Section>

        {/* ── C18: Episode Grid ── */}
        <Section id="c18" title="C18. Episode Grid">

          <SubSection title="C18a. Episode grid cells" note="EpisodeGrid.tsx:70 — 5 cell states, Framer Motion spring animations">
            <div className="max-w-md">
              <p className="text-[10px] text-gray-600 mb-2">Grid: grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5</p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
                {/* Watched */}
                <div className={`h-9 rounded text-sm font-semibold ${theme.btn} text-white flex items-center justify-center`}>1</div>
                <div className={`h-9 rounded text-sm font-semibold ${theme.btn} text-white flex items-center justify-center`}>2</div>
                <div className={`h-9 rounded text-sm font-semibold ${theme.btn} text-white flex items-center justify-center`}>3</div>
                {/* Current */}
                <div className="h-9 rounded text-sm font-semibold bg-emerald-600 text-white ring-2 ring-emerald-400 flex items-center justify-center">4</div>
                {/* Unwatched (available) */}
                <div className="h-9 rounded text-sm font-semibold bg-[#1e2736] text-gray-500 hover:bg-[#2a3a4d] flex items-center justify-center transition-colors cursor-pointer">5</div>
                <div className="h-9 rounded text-sm font-semibold bg-[#1e2736] text-gray-500 hover:bg-[#2a3a4d] flex items-center justify-center transition-colors cursor-pointer">6</div>
                {/* Not available (future) */}
                <div className="h-9 rounded text-sm font-semibold bg-[#111827] text-gray-700 flex items-center justify-center cursor-not-allowed border border-[#1e2736] border-dashed">7</div>
                <div className="h-9 rounded text-sm font-semibold bg-[#111827] text-gray-700 flex items-center justify-center cursor-not-allowed border border-[#1e2736] border-dashed">8</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-500">
                <span><span className={`inline-block w-3 h-3 rounded ${theme.activeTab} mr-1 align-middle`} /> Watched</span>
                <span><span className="inline-block w-3 h-3 rounded bg-emerald-600 ring-1 ring-emerald-400 mr-1 align-middle" /> Current</span>
                <span><span className="inline-block w-3 h-3 rounded bg-[#1e2736] mr-1 align-middle" /> Unwatched</span>
                <span><span className="inline-block w-3 h-3 rounded bg-[#111827] border border-[#1e2736] border-dashed mr-1 align-middle" /> Not aired</span>
              </div>
              <p className="text-[10px] text-gray-600 mt-2">Cells use Framer Motion: whileTap scale 0.9, whileHover scale 1.08, spring stiffness 500</p>
            </div>
          </SubSection>

          <SubSection title="C18b. Batch select (100+ episodes)" note="EpisodeGrid.tsx:51 — same as C11a">
            <Row>
              <select className="bg-[#0b0e14] border border-[#253040] rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-gray-500">
                <option>Eps 1-100</option>
                <option>Eps 101-200</option>
              </select>
              <Label>Shown for series with 100+ episodes</Label>
            </Row>
          </SubSection>

        </Section>

        {/* ── C19: Anime Grid Card (dedicated) ── */}
        <Section id="c19" title="C19. Anime Grid Card (dedicated)">

          <SubSection title="C19a. All grid card variants" note="7 locations — watchlist, search, airing, profile, franchise, playlists, recommend">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {/* Watchlist card view (full featured) */}
              <div>
                <p className="text-[10px] text-gray-600 mb-1">Watchlist</p>
                <div className="bg-[#141925] rounded-lg overflow-hidden group/card relative">
                  <div className="relative w-full aspect-[3/4] bg-[#253040]">
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <StatusBadge tone="emerald">Releasing</StatusBadge>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate">Title here</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">12/24 eps watched</p>
                    <div className="w-full h-1 bg-[#1e2736] rounded-full overflow-hidden mt-1.5">
                      <div className={`h-full rounded-full ${theme.activeTab}`} style={{ width: '50%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Search / recommend (minimal) */}
              <div>
                <p className="text-[10px] text-gray-600 mb-1">Search</p>
                <div className="bg-[#141925] rounded-lg overflow-hidden">
                  <div className="relative w-full aspect-[3/4] bg-[#253040]" />
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate">Title here</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">24 eps</p>
                  </div>
                </div>
              </div>

              {/* Airing (episode + track) */}
              <div>
                <p className="text-[10px] text-gray-600 mb-1">Airing</p>
                <div className="bg-[#141925] rounded-lg overflow-hidden group relative">
                  <div className="relative w-full aspect-[3/4] bg-[#253040]">
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <span className="text-xs font-bold text-white">Ep 5</span>
                    </div>
                    <button className={`absolute top-1.5 right-1.5 px-2 py-1 rounded text-[10px] font-semibold ${theme.activeTab} text-white`}>+ Track</button>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate">Title here</p>
                    <p className={`text-[10px] ${theme.btnText} mt-0.5`}>14:30</p>
                  </div>
                </div>
              </div>

              {/* Profile (watch status badge) */}
              <div>
                <p className="text-[10px] text-gray-600 mb-1">Profile</p>
                <div className="bg-[#141925] rounded-lg overflow-hidden">
                  <div className="relative w-full aspect-[3/4] bg-[#253040]">
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <StatusBadge tone="purple">Completed</StatusBadge>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate">Title here</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">12 eps</p>
                  </div>
                </div>
              </div>

              {/* Franchise (relation badge top-left) */}
              <div>
                <p className="text-[10px] text-gray-600 mb-1">Franchise</p>
                <div className="bg-[#141925] rounded-lg overflow-hidden">
                  <div className="relative w-full aspect-[3/4] bg-[#253040]">
                    <div className="absolute top-1 left-1">
                      <span className="px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-gray-300 font-medium">Sequel</span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-200 truncate">Title here</p>
                  </div>
                </div>
              </div>
            </div>
          </SubSection>

        </Section>

        {/* ── C20: Overlay / Wrapper Utilities ── */}
        <Section id="c20" title="C20. Overlay / Wrapper Utilities">

          <SubSection title="C20a. DisabledFilter overlay" note="components/search/DisabledFilter.tsx — opacity wrapper + tooltip">
            <Row>
              <Label>Enabled</Label>
              <div className="flex gap-2">
                <button className={`px-3 py-1 text-xs rounded-lg border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>TV</button>
                <button className="px-3 py-1 text-xs rounded-lg border border-[#253040] bg-[#0b0e14] text-gray-400">Movie</button>
              </div>
            </Row>
            <Row>
              <Label>Disabled</Label>
              <div className="relative">
                <div className="opacity-40 pointer-events-none select-none flex gap-2">
                  <button className={`px-3 py-1 text-xs rounded-lg border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>TV</button>
                  <button className="px-3 py-1 text-xs rounded-lg border border-[#253040] bg-[#0b0e14] text-gray-400">Movie</button>
                </div>
                <div className="absolute inset-0 cursor-not-allowed" />
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-[#1e2736] border border-[#253040] rounded-lg px-3 py-1.5 text-xs text-gray-300 whitespace-nowrap">
                  Not supported by Jikan
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-[#1e2736] border-b border-r border-[#253040] rotate-45" />
                </div>
              </div>
            </Row>
          </SubSection>

        </Section>

        {/* ── C21: Composite Panels ── */}
        <Section id="c21" title="C21. Composite Panels">

          <SubSection title="C21a. Filter panel skeleton" note="components/search/FilterPanel.tsx — 5-section filter panel">
            <div className="bg-[#141925] border border-[#253040] rounded-lg p-4 max-w-xl space-y-4">
              {/* Basic */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Basic</p>
                <div className="flex gap-2">
                  <button className={`px-3 py-1 text-xs rounded-lg border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>TV</button>
                  <button className="px-3 py-1 text-xs rounded-lg border border-[#253040] bg-[#0b0e14] text-gray-400">Movie</button>
                  <button className="px-3 py-1 text-xs rounded-lg border border-[#253040] bg-[#0b0e14] text-gray-400">OVA</button>
                  <button className="px-3 py-1 text-xs rounded-lg border border-[#253040] bg-[#0b0e14] text-gray-400">Special</button>
                </div>
              </div>

              <div className="border-t border-[#253040]/50" />

              {/* Content */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Content</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>Action <span className="text-gray-500 cursor-pointer">&times;</span></span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>Comedy <span className="text-gray-500 cursor-pointer">&times;</span></span>
                </div>
                <button className="text-xs text-gray-400 border border-[#253040] rounded-lg px-3 py-1 bg-[#0b0e14]">Select genres...</button>
              </div>

              <div className="border-t border-[#253040]/50" />

              {/* Score & Stats */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Score &amp; Stats</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">Score</span>
                  <input type="number" placeholder="From" className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-300" readOnly />
                  <span className="text-gray-600">&ndash;</span>
                  <input type="number" placeholder="To" className="w-20 px-2 py-1 text-xs bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-300" readOnly />
                </div>
              </div>

              <div className="border-t border-[#253040]/50" />

              {/* Production */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Production</p>
                <div className="flex gap-2">
                  <button className={`px-3 py-1 text-xs rounded-lg border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>Manga</button>
                  <button className="px-3 py-1 text-xs rounded-lg border border-[#253040] bg-[#0b0e14] text-gray-400">Original</button>
                  <button className="px-3 py-1 text-xs rounded-lg border border-[#253040] bg-[#0b0e14] text-gray-400">Light Novel</button>
                </div>
              </div>

              <div className="border-t border-[#253040]/50" />

              {/* My Watchlist */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">My Watchlist</p>
                <div className="flex gap-2">
                  <button className={`px-3 py-1 text-xs rounded-lg border ${theme.btnBg} ${theme.btnBorder} ${theme.btnText}`}>Watching</button>
                  <button className="px-3 py-1 text-xs rounded-lg border border-[#253040] bg-[#0b0e14] text-gray-400">Completed</button>
                </div>
              </div>

              <div className="border-t border-[#253040]/50" />

              {/* Action bar */}
              <div className="flex items-center gap-3 pt-1">
                <button className={`px-4 py-1.5 text-xs rounded-lg text-white ${theme.btn}`}>Apply Filters</button>
                <button className="px-4 py-1.5 text-xs rounded-lg text-gray-500 hover:text-gray-300">Clear All</button>
                <span className="text-[10px] text-gray-600 ml-auto">disabled when no changes</span>
                <button className="px-4 py-1.5 text-xs rounded-lg text-gray-600 bg-[#141925] border border-[#253040] cursor-not-allowed opacity-50">Apply Filters</button>
              </div>
            </div>
          </SubSection>

        </Section>

      </main>

      <footer className="border-t border-[#253040] px-6 py-4 text-center text-[10px] text-gray-600">
        {Object.entries(getTheme(true)).map(([k, v]) => (
          <span key={k} className="mr-4">{k}: <code className="text-gray-500">{v}</code></span>
        ))}
      </footer>
    </div>
  );
}

/* ─── Wrapper (provides SfwContext for theme-aware components) ── */

export default function InventoryClient() {
  return (
    <SfwProvider>
      <InventoryContent />
    </SfwProvider>
  );
}
