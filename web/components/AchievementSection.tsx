'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  if (!ACHIEVEMENTS_UI_VISIBLE) return null;

  const earned = achievements.filter((a) => a.unlocked && a.type === 'achievement');
  const locked = achievements.filter((a) => !a.unlocked && a.type === 'achievement');
  const recentEarned = earned.slice(0, 3);

  if (earned.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 rounded-full px-1.5 py-1 hover:bg-[#141925] transition-colors cursor-pointer"
      >
        {recentEarned.map((a) => (
          <div key={a.id} className="group/ach relative">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-[#253040]">
              <Image src={getBadgeUrl(a.asset_name)} alt={a.name} width={28} height={28} className="w-full h-full object-cover" unoptimized />
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#0b0e14] border border-[#253040] rounded-full opacity-0 group-hover/ach:opacity-100 transition-opacity pointer-events-none z-20 flex items-stretch place-items-center w-max">
              <Image src={getBadgeUrl(a.asset_name)} alt={a.name} width={80} height={80} className="p-2 h-20 object-cover flex-shrink-0" style={{ borderRadius: '11px 0 0 11px' }} unoptimized />
              <div className="pr-3 py-2.5 flex flex-col justify-center w-36">
                <p className="text-[11px] font-semibold text-gray-200 leading-tight">{a.name}</p>
                <p className="text-[10px] text-gray-400 mt-1 leading-snug overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.description}</p>
              </div>
            </div>
          </div>
        ))}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-500 ml-0.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 xl:inset-auto xl:top-1/2 xl:left-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2 xl:w-full xl:max-w-md"
            >
              <div className="bg-[#141925] rounded-t-2xl xl:rounded-2xl border-t xl:border border-[#253040] max-h-[75vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-[#253040] flex-shrink-0">
                  <h3 className="text-sm font-semibold text-gray-200">Achievements</h3>
                  <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#253040] transition-colors text-gray-400">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-3">
                  {earned.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Earned ({earned.length})</h4>
                      <div className="space-y-1.5">
                        {earned.map((a) => (
                          <div key={a.id} className="flex items-center gap-2.5 bg-[#0b0e14] rounded-lg p-2.5">
                            <Image src={getBadgeUrl(a.asset_name)} alt="" width={28} height={28} className="rounded flex-shrink-0" unoptimized />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-200">{a.name}</p>
                              <p className="text-[10px] text-gray-500 truncate">{a.description}</p>
                            </div>
                            <span className="text-[9px] text-emerald-400 flex-shrink-0">&#10003;</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {locked.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Locked ({locked.length})</h4>
                      <div className="space-y-1.5">
                        {locked.map((a) => (
                          <div key={a.id} className="flex items-center gap-2.5 bg-[#0b0e14] rounded-lg p-2.5 opacity-50">
                            <Image src={getBadgeUrl(a.asset_name)} alt="" width={28} height={28} className="rounded grayscale flex-shrink-0" unoptimized />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-400">{a.name}</p>
                              <p className="text-[10px] text-gray-600 truncate">{a.description}</p>
                              {a.target > 1 && (
                                <div className="mt-1">
                                  <div className="w-full h-1 bg-[#1e2736] rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${theme.activeTab}`} style={{ width: `${Math.min((a.progress / a.target) * 100, 100)}%` }} />
                                  </div>
                                  <p className="text-[8px] text-gray-600 mt-0.5">{a.progress}/{a.target}</p>
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
