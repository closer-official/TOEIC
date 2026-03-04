'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';
import { getCurrentEvent } from '@/lib/weekly-events';

const PRIZE_LABELS: Record<string, string> = {
  grand_prize: '特等：エターナル・クロスの欠片×2',
  a: 'A賞：超豪華XPパック（10,000 XP）',
  b_plus: 'B+賞：XPブースター（30分）',
  b_minus: 'B-賞：スタミナ・インフィニティ（30分）',
  c: 'C賞：有償ルーレット10回分チケット',
  d_plus: 'D+賞：無償ルーレット10回分チケット',
  d: 'D賞：参加賞（500 XP or 55ジェム）',
};

type BoxState = {
  boxId: string;
  remainingCount: number;
  remainingByPrize: Record<string, number>;
};

function IchibanEventContent() {
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === '1' || searchParams.get('dev') === '1';
  const current = getCurrentEvent();
  const [boxState, setBoxState] = useState<BoxState | null>(null);
  const [gems, setGems] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawLoading, setDrawLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    prizeType?: string;
    isLastOne?: boolean;
    drawnCount?: number;
    prizeCounts?: Record<string, number>;
  } | null>(null);

  const fetchState = useCallback(async () => {
    const [boxRes, gemsRes] = await Promise.all([
      fetch('/api/event/ichiban', { credentials: 'include' }),
      fetch('/api/gems', { credentials: 'include' }),
    ]);
    if (boxRes.ok) {
      const data = await boxRes.json();
      setBoxState({
        boxId: data.boxId,
        remainingCount: data.remainingCount ?? 0,
        remainingByPrize: data.remainingByPrize ?? {},
      });
      setError(null);
    } else {
      const j = await boxRes.json().catch(() => ({}));
      setError(j.error ?? '状態の取得に失敗しました');
      setBoxState(null);
    }
    if (gemsRes.ok) {
      const g = await gemsRes.json();
      setGems(g.gems ?? 0);
    } else {
      setGems(0);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchState().finally(() => setLoading(false));
  }, [fetchState]);

  const handleDrawOne = async () => {
    if (drawLoading || boxState?.remainingCount === 0) return;
    setDrawLoading(true);
    setLastResult(null);
    setError(null);
    try {
      const res = await fetch('/api/event/ichiban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'one' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'くじを引けませんでした');
        return;
      }
      setLastResult({
        prizeType: data.prizeType,
        isLastOne: data.isLastOne,
      });
      await fetchState();
    } finally {
      setDrawLoading(false);
    }
  };

  const handleBuyAll = async () => {
    if (drawLoading || !boxState || boxState.remainingCount === 0) return;
    const cost = boxState.remainingCount * 100;
    if (gems !== null && gems < cost) {
      setError(`チップが足りません。${cost}必要です。（所持: ${gems}）`);
      return;
    }
    setDrawLoading(true);
    setLastResult(null);
    setError(null);
    try {
      const res = await fetch('/api/event/ichiban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'all' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? '購入に失敗しました');
        return;
      }
      setLastResult({
        drawnCount: data.drawnCount,
        prizeCounts: data.prizeCounts,
        isLastOne: data.isLastOne,
      });
      await fetchState();
    } finally {
      setDrawLoading(false);
    }
  };

  if (current.id !== 'ichiban' && !isPreview) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <AppHeader backHref="/event" />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6">
          <p className="mt-4 text-zinc-400">今週は至高の1番くじではありません。</p>
          <Link href="/event" className="mt-2 inline-block text-gold hover:text-gold-bright">
            ← イベント一覧へ
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader backHref="/event" />
      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <h1 className="text-xl font-bold text-white">至高の1番くじ</h1>
        <p className="mt-2 text-sm text-zinc-500">
          1箱200枚を全ユーザーで共有。残り枚数と景品がリアルタイムで見えます。
        </p>

        {loading ? (
          <LoadingWithPercent className="mt-6 block text-zinc-500" />
        ) : error ? (
          <div className="mt-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => { setLoading(true); fetchState().finally(() => setLoading(false)); }}
              className="mt-2 text-sm text-gold hover:text-gold-bright"
            >
              再読み込み
            </button>
          </div>
        ) : boxState ? (
          <>
            <section className="mt-6 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
              <h2 className="text-base font-semibold text-gold">現在の箱</h2>
              <p className="mt-2 text-2xl font-bold text-white">
                残り <span className="text-gold">{boxState.remainingCount}</span> 枚
              </p>
              <p className="mt-1 text-xs text-zinc-500">1枚＝100ジェム（全買い＝残り枚数×100ジェム）</p>
            </section>

            <section className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
              <h2 className="text-base font-semibold text-white">残り景品一覧</h2>
              <ul className="mt-3 space-y-1.5">
                {Object.entries(boxState.remainingByPrize).map(([key, count]) => {
                  if (count === 0) return null;
                  return (
                    <li key={key} className="flex justify-between text-sm">
                      <span className="text-zinc-300">{PRIZE_LABELS[key] ?? key}</span>
                      <span className="font-medium text-gold">{count}本</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-zinc-500">
                200枚目を引いた人にラストワン賞（エターナル・クロスの欠片×3）を付与します。
              </p>
            </section>

            <section className="mt-6 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
              <h2 className="text-base font-semibold text-white">プレイ</h2>
              <p className="mt-1 text-sm text-zinc-500">所持ジェム: {gems ?? '—'} 💎</p>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleDrawOne}
                  disabled={drawLoading || boxState.remainingCount === 0 || (gems !== null && gems < 100)}
                  className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 py-3 font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50 disabled:hover:bg-[var(--gold)]/20"
                >
                  {drawLoading ? '処理中…' : '1枚引く（100ジェム）'}
                </button>
                <button
                  type="button"
                  onClick={handleBuyAll}
                  disabled={
                    drawLoading ||
                    boxState.remainingCount === 0 ||
                    (gems !== null && gems < boxState.remainingCount * 100)
                  }
                  className="rounded-lg border border-gold-subtle bg-zinc-800 py-3 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {drawLoading
                    ? '処理中…'
                    : `残り全部買う（${boxState.remainingCount * 100}ジェム）`}
                </button>
              </div>
            </section>

            {lastResult && (
              <section className="mt-6 rounded-xl border border-gold-subtle bg-[var(--gold)]/10 p-4">
                <h2 className="text-base font-semibold text-gold">結果</h2>
                {lastResult.prizeType && (
                  <p className="mt-2 text-white">
                    {PRIZE_LABELS[lastResult.prizeType] ?? lastResult.prizeType}
                    {lastResult.isLastOne && (
                      <span className="ml-2 rounded bg-gold/20 px-2 py-0.5 text-sm text-gold">
                        ラストワン賞（欠片×3）付き
                      </span>
                    )}
                  </p>
                )}
                {lastResult.drawnCount != null && lastResult.prizeCounts && (
                  <div className="mt-2">
                    <p className="text-sm text-zinc-400">{lastResult.drawnCount}枚引きました。</p>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                      {Object.entries(lastResult.prizeCounts).map(([key, n]) => {
                        if (n === 0) return null;
                        return (
                          <li key={key}>
                            {PRIZE_LABELS[key] ?? key} × {n}
                          </li>
                        );
                      })}
                    </ul>
                    {lastResult.isLastOne && (
                      <p className="mt-2 text-gold">ラストワン賞（エターナル・クロスの欠片×3）を獲得しました。</p>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        ) : null}

        <p className="mt-8 text-center">
          <Link href="/event" className="text-sm text-gold hover:text-gold-bright">
            ← イベント一覧へ
          </Link>
        </p>
      </main>
      <BottomNav />
    </div>
  );
}

export default function IchibanEventPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <AppHeader backHref="/event" />
        <main className="flex min-h-0 flex-1 items-center justify-center px-4">
          <LoadingWithPercent className="text-zinc-500" />
        </main>
        <BottomNav />
      </div>
    }>
      <IchibanEventContent />
    </Suspense>
  );
}
