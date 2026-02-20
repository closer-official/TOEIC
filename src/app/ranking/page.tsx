'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { GameMenu } from '@/components/GameMenu';

type ModeKey = 'part5' | 'vocab';
type RankKey = 'ROOKIE' | 'ACE' | 'LEGEND';

interface RunRow {
  id: string;
  user_id: string;
  score: number;
  total_time_ms: number;
  created_at: string;
  game_mode: ModeKey;
  survival_rank: RankKey;
  username?: string | null;
}

export default function RankingPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [modeKey, setModeKey] = useState<ModeKey>('part5');
  const [rankKey, setRankKey] = useState<RankKey>('ROOKIE');

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session?.user);

      try {
        const { data: runsData, error } = await supabase
          .from('runs')
          .select('id, user_id, score, total_time_ms, created_at, game_mode, survival_rank')
          .eq('game_mode', modeKey)
          .eq('survival_rank', rankKey)
          .order('score', { ascending: false })
          .limit(150);
        if (error) {
          console.warn('runs fetch', error.message);
          setRuns([]);
          setLoading(false);
          return;
        }
        const raw = Array.isArray(runsData) ? runsData : [];
        const bestByUser = new Map<string, typeof raw[0]>();
        for (const r of raw) {
          const cur = bestByUser.get(r.user_id);
          if (!cur || r.score > cur.score || (r.score === cur.score && r.total_time_ms < cur.total_time_ms)) {
            bestByUser.set(r.user_id, r);
          }
        }
        const list = [...bestByUser.values()].sort((a, b) => {
          if (a.score !== b.score) return b.score - a.score;
          return a.total_time_ms - b.total_time_ms;
        }).slice(0, 20);
        if (list.length === 0) {
          setRuns([]);
          setLoading(false);
          return;
        }
        const nameByUserId = new Map<string, string | null>();
        const userIds = [...new Set(list.map((r) => r.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, username')
          .in('user_id', userIds);
        if (profilesData) {
          for (const p of profilesData) {
            nameByUserId.set(p.user_id, p.username ?? null);
          }
        }
        setRuns(
          list.map((r) => ({
            ...r,
            username: nameByUserId.get(r.user_id) ?? null,
          }))
        );
      } catch {
        setRuns([]);
      } finally {
        setLoading(false);
      }
    };
    setLoading(true);
    load();
  }, [modeKey, rankKey]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-zinc-950">
      <header className="fixed left-0 right-0 top-0 z-40 flex shrink-0 items-center justify-between border-b border-zinc-800/50 bg-zinc-950/90 px-4 py-3 backdrop-blur sm:px-6">
        <GameMenu variant="home" />
        <Link href="/" className="touch-target text-lg font-bold text-white active:opacity-80 hover:text-amber-400">
          瞬
        </Link>
        <div className="w-11" />
      </header>
      <div className="px-4 pt-16 pb-8 safe-area-pad sm:px-6 sm:py-8">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-white sm:text-2xl">全国ランキング</h1>
        <p className="mt-1 text-sm text-zinc-500">単語 / Part 5 × 3ランクで6つのランキング</p>

        <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="inline-flex rounded-full bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setModeKey('part5')}
              className={`touch-target rounded-full px-3 py-2 text-xs font-medium sm:py-1 ${
                modeKey === 'part5'
                  ? 'bg-amber-500 text-black'
                  : 'text-zinc-400 active:opacity-80 hover:text-white'
              }`}
            >
              Part 5
            </button>
            <button
              type="button"
              onClick={() => setModeKey('vocab')}
              className={`touch-target rounded-full px-3 py-2 text-xs font-medium sm:py-1 ${
                modeKey === 'vocab'
                  ? 'bg-amber-500 text-black'
                  : 'text-zinc-400 active:opacity-80 hover:text-white'
              }`}
            >
              単語
            </button>
          </div>
          <div className="inline-flex rounded-full bg-zinc-900 p-1">
            {(['ROOKIE', 'ACE', 'LEGEND'] as RankKey[]).map((rk) => (
              <button
                key={rk}
                type="button"
                onClick={() => setRankKey(rk)}
                className={`touch-target rounded-full px-3 py-2 text-xs font-medium sm:py-1 ${
                  rankKey === rk
                    ? 'bg-amber-500 text-black'
                    : 'text-zinc-400 active:opacity-80 hover:text-white'
                }`}
              >
                {rk}
              </button>
            ))}
          </div>
        </div>
        {!isLoggedIn && (
          <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            ゲストのままプレイしたスコアはランキングに反映されません。ログインすると記録されます。
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-zinc-500">読み込み中...</p>
        ) : runs.length === 0 ? (
          <p className="mt-8 text-zinc-500">まだ記録がありません</p>
        ) : (
          <ul className="mt-6 space-y-2">
            {runs.map((run, i) => (
              <motion.li
                key={run.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between gap-2 rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3"
              >
                <span className="shrink-0 text-lg font-bold text-amber-400">#{i + 1}</span>
                <span className="min-w-0 truncate text-white" title={run.username ?? '匿名'}>
                  {run.username?.trim() || '匿名'}
                </span>
                <span className="shrink-0 font-medium text-white">{run.score} pt</span>
                <span className="shrink-0 text-sm text-zinc-500">
                  {(run.total_time_ms / 1000).toFixed(1)}秒
                </span>
              </motion.li>
            ))}
          </ul>
        )}
        </div>
      </div>
    </div>
  );
}
