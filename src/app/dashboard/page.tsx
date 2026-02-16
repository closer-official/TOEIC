'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { db, type WordProgress, STAGE_LABELS, type MemoryStage } from '@/lib/db';
import { computeRetentionRate } from '@/lib/ebbinghaus';

interface DotItem {
  wordId: string;
  stage: MemoryStage;
  nextReviewAt: number;
  retention: number;
  isDegraded: boolean;
}

export default function DashboardPage() {
  const [dots, setDots] = useState<DotItem[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<MemoryStage, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  });

  useEffect(() => {
    const load = async () => {
      const now = Date.now();
      const allProgress = await db.wordProgress.toArray();
      const allWords = await db.words.toArray();
      const wordIds = new Set(allWords.map((w) => w.id));
      const items: DotItem[] = [];

      for (const p of allProgress) {
        if (!wordIds.has(p.wordId)) continue;
        const tDays = (now - p.lastReviewedAt) / (24 * 60 * 60 * 1000);
        const R = computeRetentionRate(tDays, p.memoryStrength);
        const hoursUntilDue = (p.nextReviewAt - now) / (60 * 60 * 1000);
        const isDegraded = hoursUntilDue <= 24 && hoursUntilDue > 0;
        items.push({
          wordId: p.wordId,
          stage: p.stage,
          nextReviewAt: p.nextReviewAt,
          retention: R,
          isDegraded,
        });
      }

      const noProgress = allWords.filter(
        (w) => !allProgress.some((p) => p.wordId === w.id)
      );
      noProgress.forEach((w) => {
        items.push({
          wordId: w.id,
          stage: 1,
          nextReviewAt: 0,
          retention: 0,
          isDegraded: true,
        });
      });

      setDots(items);

      const counts: Record<MemoryStage, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };
      items.forEach((d) => (counts[d.stage] = (counts[d.stage] ?? 0) + 1));
      setStageCounts(counts);
    };
    load();
  }, []);

  const maxCount = Math.max(1, ...Object.values(stageCounts));

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-white">
      <header className="mb-8">
        <Link href="/" className="text-sm text-zinc-400 hover:text-amber-500">
          ← ホーム
        </Link>
        <h1 className="mt-4 text-2xl font-bold">記憶の分布図（Sticker Map）</h1>
        <p className="mt-1 text-zinc-500">Stage 1 = 新規 ～ Stage 5 = 殿堂入り</p>
      </header>

      <div className="mb-8 rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
        <p className="mb-4 text-center text-sm text-zinc-500">記憶の強さ</p>
        <div className="flex items-end justify-between gap-2">
          {([1, 2, 3, 4, 5] as const).map((stage) => (
            <div key={stage} className="flex flex-1 flex-col items-center">
              <motion.div
                className="w-full rounded-t bg-amber-500/80"
                initial={{ height: 0 }}
                animate={{
                  height: `${(stageCounts[stage] / maxCount) * 120}px`,
                }}
                transition={{ duration: 0.5 }}
              />
              <span className="mt-2 text-xs text-zinc-500">
                {STAGE_LABELS[stage]}
              </span>
              <span className="font-bold">{stageCounts[stage]}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between text-xs text-zinc-500">
          <span>弱い</span>
          <span>強い</span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="mb-4 font-semibold">シールの居住地（Stage別エリア）</h2>
        <div className="flex gap-2">
          {([1, 2, 3, 4, 5] as const).map((stage) => (
            <div
              key={stage}
              className="flex flex-1 flex-col rounded-xl border border-zinc-700 bg-zinc-800/50 p-3"
            >
              <span className="mb-2 text-xs text-zinc-500">
                {STAGE_LABELS[stage]}
              </span>
              <div className="flex min-h-[80px] flex-wrap gap-1">
                {dots
                  .filter((d) => d.stage === stage)
                  .map((d, i) => (
                    <motion.div
                      key={d.wordId}
                      layout
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{
                        opacity: d.isDegraded ? 0.5 : 1,
                        scale: 1,
                        x: d.isDegraded ? -2 : 0,
                      }}
                      transition={{ delay: i * 0.015 }}
                      className={`h-2.5 w-2.5 rounded-full ${
                        d.isDegraded ? 'bg-zinc-500' : 'bg-amber-500'
                      }`}
                      title={
                        d.isDegraded ? '復習が近い' : `Stage ${d.stage}`
                      }
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          くすんだシール = 復習タイミングが近い（左のエリアへ戻りかけ）
        </p>
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href="/game"
          className="rounded-xl bg-amber-500 px-8 py-4 font-bold text-black hover:bg-amber-400"
        >
          プレイする
        </Link>
      </div>
    </div>
  );
}
