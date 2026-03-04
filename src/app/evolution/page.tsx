'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';
import { costForNextLevel, SEASON_BRANCHES, type EvolutionBranch } from '@/lib/evolution';

type SessionUser = { id: string; avatarUrl: string | null };
type EvolutionState = {
  points: number;
  branches: { correct_time: number; score: number; wrong_penalty: number };
  seasonCarry?: { correct_time: number; score: number; wrong_penalty: number };
  currentSeason?: string;
  seasonEnd?: string;
};

const SEASON_BOOSTS: {
  id: EvolutionBranch;
  icon: string;
  label: string;
  effectThisSeason: string;
  effectCarry: string;
  /** 表示用: 今シーズン値のフォーマット (level, carry) => string */
  formatValue: (level: number, carry: number) => string;
}[] = [
  {
    id: 'correct_time',
    icon: '📖',
    label: '研鑽の極意',
    effectThisSeason: '獲得XPアップ +1.0% (最大10%)',
    effectCarry: '基礎XP倍率 +1.0% (1.01倍)',
    formatValue: (level, carry) => `+${level}%${carry ? ' / 翌シーズン 1.01倍' : ''}`,
  },
  {
    id: 'score',
    icon: '👑',
    label: '至高の技巧',
    effectThisSeason: '基礎スコアアップ +1.0% (最大10%)',
    effectCarry: '基礎スコア倍率 +1.0% (1.01倍)',
    formatValue: (level, carry) => `+${level}%${carry ? ' / 翌シーズン 1.01倍' : ''}`,
  },
  {
    id: 'wrong_penalty',
    icon: '🔥',
    label: '魂の燃焼',
    effectThisSeason: 'スタミナ回復速度 +1% (最大10%早い)',
    effectCarry: 'スタミナ回復速度 +1% (1.01倍)',
    formatValue: (level, carry) => `+${level}%${carry ? ' / 翌シーズン 1.01倍' : ''}`,
  },
];

function useSeasonCountdown(seasonEndIso: string | undefined) {
  const [rem, setRem] = useState({ days: 0, hours: 0, minutes: 0 });
  useEffect(() => {
    if (!seasonEndIso) return;
    const tick = () => {
      const end = new Date(seasonEndIso).getTime();
      const diff = Math.max(0, end - Date.now());
      setRem({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
      });
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [seasonEndIso]);
  return rem;
}

export default function EvolutionPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null | 'loading'>('loading');
  const [evolution, setEvolution] = useState<EvolutionState | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loadingBranch, setLoadingBranch] = useState<EvolutionBranch | null>(null);
  const seasonRem = useSeasonCountdown(evolution?.seasonEnd);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        setSession(null);
        return;
      }
      const avatarUrl =
        (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null;
      setSession({ id: u.id, avatarUrl });
    });
  }, []);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session, router]);

  const fetchEvolution = useCallback(() => {
    if (session === 'loading' || typeof session !== 'object') return;
    setEvolutionLoading(true);
    fetch('/api/evolution', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setEvolution(data && typeof (data as EvolutionState).points === 'number' ? data : null);
      })
      .catch(() => setEvolution(null))
      .finally(() => setEvolutionLoading(false));
  }, [session]);

  useEffect(() => {
    fetchEvolution();
  }, [fetchEvolution]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchEvolution();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchEvolution]);

  const handleUpgrade = useCallback(
    async (branch: EvolutionBranch) => {
      if (!evolution) return;
      const level = evolution.branches[branch];
      const isSeasonBranch = (SEASON_BRANCHES as readonly string[]).includes(branch);
      const cost = costForNextLevel(level, branch);
      const maxLevel = isSeasonBranch ? 10 : 9;
      if (level >= maxLevel || evolution.points < cost) return;
      setMsg(null);
      setLoadingBranch(branch);
      try {
        const res = await fetch('/api/evolution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'upgrade', branch }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          setEvolution((e) =>
            e
              ? {
                  ...e,
                  points: j.points ?? e.points - cost,
                  branches: { ...e.branches, [branch]: j.level ?? level + 1 },
                }
              : e
          );
          setMsg({ type: 'ok', text: '進化しました' });
        } else {
          setMsg({ type: 'err', text: j.error ?? '失敗しました' });
        }
      } catch {
        setMsg({ type: 'err', text: 'エラー' });
      } finally {
        setLoadingBranch(null);
      }
    },
    [evolution]
  );

  if (session === 'loading' || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  const xp = evolution?.points ?? 0;
  const totalBonus = 1 + 0.01 * (evolution?.branches.correct_time ?? 0) + 0.01 * (evolution?.branches.score ?? 0) + 0.01 * (evolution?.branches.wrong_penalty ?? 0);

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-zinc-950">
      <AppHeader backHref="/" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>
        <h1 className="text-xl font-bold text-white">進化</h1>
        <p className="mt-2 text-sm text-zinc-500">
          全国モードで獲得したXPでシーズン強化ができます。
        </p>

        {/* XP 表示 */}
        <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3">
          {evolutionLoading && evolution == null ? (
            <LoadingWithPercent label="読み込み中" className="block text-sm text-zinc-500" />
          ) : evolution == null ? (
            <div>
              <p className="text-sm text-zinc-400">所持XP を取得できませんでした</p>
              <button
                type="button"
                onClick={() => fetchEvolution()}
                className="mt-2 text-sm text-amber-500 hover:text-amber-400"
              >
                再読み込み
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-400">
                所持XP <span className="font-bold text-amber-400">{xp.toLocaleString()}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                累積ボーナス倍率: +{totalBonus.toFixed(2)}x
              </p>
            </>
          )}
        </div>

        {/* シーズン強化 */}
        <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3">
              <p className="text-xs text-zinc-500">
                {evolution?.currentSeason ? `${evolution.currentSeason.replace(/-(\d+)$/, (_, m) => `年${parseInt(m, 10)}月`)}シーズン` : '今月のシーズン'}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                シーズン終了まで <span className="font-bold text-white">{seasonRem.days}日 {seasonRem.hours}時間 {seasonRem.minutes}分</span>
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              各Lv.10達成で翌シーズンに特典が継承されます。
            </p>
            <div className="space-y-3">
              {SEASON_BOOSTS.map((boost) => {
                const level = evolution?.branches[boost.id] ?? 0;
                const carryKey = boost.id as 'correct_time' | 'score' | 'wrong_penalty';
                const carry = evolution?.seasonCarry?.[carryKey] ?? 0;
                const cost = costForNextLevel(level, boost.id);
                const canUp = level < 10 && xp >= cost;
                const isMax = level >= 10;
                const valueText = boost.formatValue(level, carry);
                return (
                  <div
                    key={boost.id}
                    className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-xl" aria-hidden>{boost.icon}</span>
                        <p className="mt-1 font-medium text-white">
                          {boost.label} (Lv.{level})
                          {carry > 0 && <span className="ml-1.5 text-xs font-bold text-amber-400">翌シーズン特典付与</span>}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          今シーズン: {boost.effectThisSeason} → {valueText}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Lv.10達成時: {boost.effectCarry}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isMax ? (
                          <span className="rounded-lg border border-amber-500/50 bg-amber-900/30 px-3 py-1.5 text-xs font-bold text-amber-300">
                            MAX
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpgrade(boost.id)}
                            disabled={!canUp || loadingBranch !== null}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
                          >
                            {loadingBranch === boost.id ? '…' : `${cost.toLocaleString()} XP`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        {msg && (
          <div
            className={`fixed bottom-24 left-4 right-4 z-50 rounded-lg px-4 py-3 text-center text-sm sm:left-1/2 sm:right-auto sm:w-80 sm:-translate-x-1/2 ${
              msg.type === 'ok' ? 'bg-zinc-800 border border-emerald-600/50 text-emerald-200' : 'bg-zinc-800 border border-red-600/50 text-red-200'
            }`}
          >
            {msg.text}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
