'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface RunRow {
  id: string;
  user_id: string;
  score: number;
  total_time_ms: number;
  created_at: string;
}

export default function RankingPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/runs?limit=20')
      .then((r) => r.json())
      .then((data) => {
        setRuns(Array.isArray(data) ? data : []);
      })
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
          ← ホーム
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-white">全国ランキング</h1>
        <p className="mt-1 text-sm text-zinc-500">スコア順・同点なら回答時間の短い順</p>

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
                className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3"
              >
                <span className="text-lg font-bold text-amber-400">#{i + 1}</span>
                <span className="text-white">{run.score} 問正解</span>
                <span className="text-sm text-zinc-500">
                  {(run.total_time_ms / 1000).toFixed(1)}秒
                </span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
