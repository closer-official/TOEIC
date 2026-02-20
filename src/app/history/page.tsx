'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { GameMenu } from '@/components/GameMenu';

export default function HistoryPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ id: string } | null | 'loading'>('loading');
  const [stats, setStats] = useState<{
    estimatedScore: number;
    baseScore: number;
    scoreHistory: Array<{ score: number; gameMode: string; survivalRank: string; createdAt: string }>;
    totalPlayTimeMs?: number;
    modeStats?: { part5: { count: number; avgScore: number }; vocab: { count: number; avgScore: number } };
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session?.user ? { id: data.session.user.id } : null);
    });
  }, []);

  useEffect(() => {
    if (session === null) {
      router.replace('/login');
      return;
    }
    if (session === 'loading' || typeof session !== 'object') return;
    fetch('/api/my-stats')
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => {});
  }, [session, router]);

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return `${h}時間${m}分`;
    if (m > 0) return `${m}分`;
    return `${totalSec}秒`;
  };

  if (session === 'loading' || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-zinc-950">
      <header className="fixed left-0 right-0 top-0 z-40 flex shrink-0 items-center justify-between border-b border-zinc-800/50 bg-zinc-950/90 px-4 py-3 backdrop-blur sm:px-6">
        <GameMenu variant="home" />
        <Link
          href="/"
          className="touch-target text-lg font-bold text-white active:opacity-80 hover:text-amber-400"
        >
          瞬
        </Link>
        <div className="w-11" />
      </header>
      <main className="px-4 pt-16 pb-8 safe-area-pad sm:px-6">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-white sm:text-2xl">学習履歴</h1>
          <p className="mt-1 text-sm text-zinc-500">プレイ結果と予想スコア</p>

          {!stats ? (
            <p className="mt-8 text-center text-zinc-500">読込中...</p>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 space-y-6"
            >
              {typeof stats.totalPlayTimeMs === 'number' && (
                <section className="rounded-2xl border border-zinc-700 bg-zinc-900/50 p-4">
                  <h2 className="text-sm font-medium text-zinc-400">総プレイ時間</h2>
                  <p className="mt-1 text-xl font-bold text-white">{formatDuration(stats.totalPlayTimeMs)}</p>
                </section>
              )}

              {stats.modeStats && (
                <section className="rounded-2xl border border-zinc-700 bg-zinc-900/50 p-4">
                  <h2 className="text-sm font-medium text-zinc-400">各モードの成績</h2>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Part 5</span>
                      <span className="text-white">
                        平均 {stats.modeStats.part5.avgScore}点 ・ {stats.modeStats.part5.count}回
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">単語</span>
                      <span className="text-white">
                        平均 {stats.modeStats.vocab.avgScore}点 ・ {stats.modeStats.vocab.count}回
                      </span>
                    </div>
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-zinc-700 bg-zinc-900/50 p-4">
                <h2 className="text-sm font-medium text-zinc-400">予想TOEICスコア</h2>
                <p className="mt-1 text-3xl font-bold text-amber-400">{stats.estimatedScore} 点</p>
                <p className="mt-1 text-xs text-zinc-500">入力スコア: {stats.baseScore}点</p>
              </section>

              <section className="rounded-2xl border border-zinc-700 bg-zinc-900/50 p-4">
                <h2 className="text-sm font-medium text-zinc-400">スコア遍歴（直近20件）</h2>
                {stats.scoreHistory.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-500">まだプレイ履歴がありません</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {[...stats.scoreHistory]
                      .reverse()
                      .slice(0, 20)
                      .map((r, i) => (
                        <li
                          key={`${r.createdAt}-${i}`}
                          className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2 text-sm"
                        >
                          <span className="text-zinc-400">
                            {r.gameMode === 'part5' ? 'Part5' : '単語'} {r.survivalRank}
                          </span>
                          <span className="font-bold text-white">{r.score}</span>
                          <span className="text-xs text-zinc-500">{formatDate(r.createdAt)}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            </motion.div>
          )}

          <p className="mt-8 text-center">
            <Link href="/" className="text-sm text-amber-500/80 hover:text-amber-400">
              ← ホームへ
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
