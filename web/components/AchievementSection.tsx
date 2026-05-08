'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useSfw } from '@/lib/sfw-context';
import { getTheme } from '@/lib/theme';
import { getBadgeUrl } from '@/lib/achievements/badge-url';
import { ACHIEVEMENTS_UI_VISIBLE } from '@/lib/feature-flags';

interface AchievementProgress {
  id: string;
  name: string;
  description: string;
  asset_name: string;
  progress: number;
  target: number;
  unlocked: boolean;
  unlocked_at: string | null;
  type: string;
}

export default function AchievementSection() {
  const { userId } = useAuth();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const [achievements, setAchievements] = useState<AchievementProgress[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!ACHIEVEMENTS_UI_VISIBLE || !userId) return;
    fetch(`/api/achievements?userId=${userId}`)
      .then((r) => r.ok ? r.json() : { achievements: [] })
      .then((d) => setAchievements(d.achievements || []))
      .catch(() => {});
  }, [userId]);

  if (!ACHIEVEMENTS_UI_VISIBLE || achievements.length === 0) return null;

  const earned = achievements.filter((a) => a.unlocked && a.type === 'achievement');
  const locked = achievements.filter((a) => !a.unlocked && a.type === 'achievement');
  const recentEarned = earned.slice(0, 3);

  if (earned.length === 0 && locked.length === 0) return null;

  return (
    <>
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Achievements</h2>
          {(earned.length > 3 || locked.length > 0) && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              View all
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {recentEarned.map((a) => (
            <div key={a.id} className="group/ach relative flex items-center gap-2 bg-[#141925] rounded-lg p-2.5 border border-[#253040]/50">
              <Image src={getBadgeUrl(a.asset_name)} alt="" width={28} height={28} className="rounded" unoptimized />
              <span className="text-xs text-gray-300 font-medium">{a.name}</span>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-[#0b0e14] border border-[#253040] rounded-lg opacity-0 group-hover/ach:opacity-100 transition-opacity pointer-events-none z-20 min-w-[160px] text-center">
                <p className="text-[10px] text-gray-400">{a.description}</p>
              </div>
            </div>
          ))}
          {earned.length === 0 && (
            <p className="text-xs text-gray-600">No achievements earned yet.</p>
          )}
        </div>
      </div>

      {modalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up xl:inset-auto xl:top-1/2 xl:left-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2 xl:w-full xl:max-w-lg">
            <div className="bg-[#141925] rounded-t-2xl xl:rounded-2xl border-t xl:border border-[#253040] max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-[#253040] flex-shrink-0">
                <h3 className="text-sm font-semibold text-gray-200">Achievements</h3>
                <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#253040] transition-colors text-gray-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {earned.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Earned ({earned.length})</h4>
                    <div className="space-y-2">
                      {earned.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 bg-[#0b0e14] rounded-lg p-3">
                          <Image src={getBadgeUrl(a.asset_name)} alt="" width={32} height={32} className="rounded" unoptimized />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200">{a.name}</p>
                            <p className="text-[10px] text-gray-500">{a.description}</p>
                          </div>
                          <span className="text-[10px] text-emerald-400">Earned</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {locked.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Locked ({locked.length})</h4>
                    <div className="space-y-2">
                      {locked.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 bg-[#0b0e14] rounded-lg p-3 opacity-60">
                          <Image src={getBadgeUrl(a.asset_name)} alt="" width={32} height={32} className="rounded grayscale" unoptimized />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-400">{a.name}</p>
                            <p className="text-[10px] text-gray-600">{a.description}</p>
                            {a.target > 1 && (
                              <div className="mt-1.5">
                                <div className="w-full h-1 bg-[#1e2736] rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${theme.activeTab}`} style={{ width: `${Math.min((a.progress / a.target) * 100, 100)}%` }} />
                                </div>
                                <p className="text-[9px] text-gray-600 mt-0.5">{a.progress}/{a.target}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-3 mt-1 xl:hidden" />
            </div>
          </div>
        </>
      )}
    </>
  );
}
