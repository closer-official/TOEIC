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
  a: 'A賞：チップパック（10,000チップ）',
  b_plus: 'B+賞：XPブースター（30分）',
  b_minus: 'B-賞：スタミナ・インフィニティ（30分）',
  c: 'C賞：有償ルーレット10回分チケット',
  d_plus: 'D+賞：無償ルーレット10回分チケット',
  d: 'D賞：参加賞（500 XP or 55チップ）',
};

const PRIZE_ORDER = ['grand_prize', 'a', 'b_plus', 'b_minus', 'c', 'd_plus', 'd'] as const;

/** 箱内クジのランダム角度（10〜45度の範囲で重ね感を出す・再現性のため固定配列） */
const TICKET_ROTATIONS = [12, -28, 18, 35, -22, 41, -15, 26, -38, 14, 32, -45, 20, -33, 25, -19, 42, -11, 10, 44, -27, 16, 37, -24, 29, -40];

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
  const [peelModal, setPeelModal] = useState<{ prizeType: string; isLastOne?: boolean } | null>(null);
  const [peelPhase, setPeelPhase] = useState<'idle' | 'peeling' | 'revealed'>('idle');
  const [flyPhase, setFlyPhase] = useState<'idle' | 'flying'>('idle');
  const [resultQueue, setResultQueue] = useState<{ prizeType: string; isLastOne?: boolean }[]>([]);
  const [drawCount, setDrawCount] = useState(1);

  const fetchState = useCallback(async () => {
    const ichibanUrl = isPreview ? '/api/event/ichiban?preview=1' : '/api/event/ichiban';
    const [boxRes, gemsRes] = await Promise.all([
      fetch(ichibanUrl, { credentials: 'include' }),
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
  }, [isPreview]);

  useEffect(() => {
    setLoading(true);
    fetchState().finally(() => setLoading(false));
  }, [fetchState]);

  const handleDrawOne = async () => {
    if (drawLoading || boxState?.remainingCount === 0) return;
    const count = Math.min(drawCount, Math.floor((gems ?? 0) / 100), boxState?.remainingCount ?? 0, 5);
    if (count < 1) return;
    setDrawLoading(true);
    setLastResult(null);
    setError(null);
    const queue: { prizeType: string; isLastOne?: boolean }[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const res = await fetch('/api/event/ichiban', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'one', ...(isPreview ? { preview: true } : {}) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'くじを引けませんでした');
          break;
        }
        queue.push({ prizeType: data.prizeType, isLastOne: data.isLastOne });
        if (i === 0) {
          setLastResult({ prizeType: data.prizeType, isLastOne: data.isLastOne });
        }
      }
      await fetchState();
      if (queue.length > 0) {
        setResultQueue(queue);
        setFlyPhase('flying');
      }
    } finally {
      setDrawLoading(false);
    }
  };

  const handlePeelClick = () => {
    if (peelPhase !== 'idle') return;
    setPeelPhase('peeling');
    setTimeout(() => {
      setPeelPhase('revealed');
      setTimeout(() => {
        setPeelModal(null);
        setPeelPhase('idle');
        setResultQueue((prev) => {
          if (prev.length <= 1) return [];
          const next = prev.slice(1);
          requestAnimationFrame(() => {
            setPeelModal(next[0] ?? null);
          });
          setLastResult({ prizeType: next[0]!.prizeType, isLastOne: next[0]!.isLastOne });
          return next;
        });
      }, 2500);
    }, 900);
  };

  const handleFlyingTicketEnd = () => {
    setFlyPhase('idle');
    setResultQueue((prev) => {
      if (prev.length === 0) return [];
      setPeelModal(prev[0] ?? null);
      setPeelPhase('idle');
      return prev.length > 1 ? prev.slice(1) : [];
    });
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
        body: JSON.stringify({ action: 'all', ...(isPreview ? { preview: true } : {}) }),
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

  const eventListHref = isPreview ? '/event?preview=1' : '/event';

  if (current.id !== 'ichiban' && !isPreview) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <AppHeader backHref={eventListHref} />
        <main className="min-h-0 flex-1 overflow-y-auto content-below-header safe-area-pad px-4 sm:px-6">
          <div className="mx-auto max-w-2xl pt-4">
            <p className="text-zinc-400">今週は至高の1番くじではありません。</p>
            <Link href={eventListHref} className="mt-2 inline-block text-gold hover:text-gold-bright">
              ← イベント一覧へ
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const tickerText = `【速報】残り${boxState?.remainingCount ?? '—'}枚　至高の1番くじ　1枚100チップ　200枚目でラストワン賞（エターナル・クロスの欠片×3）　`;

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader backHref={eventListHref} />

      {/* ニュースティッカー */}
      <div className="overflow-hidden border-b border-zinc-700 bg-zinc-900/90 py-2">
        <div className="ichiban-ticker-track flex w-max items-center gap-8 whitespace-nowrap text-xs font-medium text-amber-200/90">
          <span>{tickerText.repeat(4)}</span>
        </div>
      </div>

      <main
        className="min-h-0 flex-1 overflow-y-auto content-below-header safe-area-pad px-4 sm:px-6"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto max-w-2xl">
          <header className="pt-4 pb-2">
            <h1 className="ichiban-title-wrap text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="ichiban-title-gold">至高の1番くじ</span>
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              1箱200枚を全ユーザーで共有。1枚引いて賞を当てよう。
            </p>
          </header>

          {loading ? (
            <LoadingWithPercent className="mt-8 block text-zinc-500" />
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-800/50 bg-red-950/30 px-5 py-4">
              <p className="text-sm text-red-200">{error}</p>
              <button
                type="button"
                onClick={() => { setLoading(true); fetchState().finally(() => setLoading(false)); }}
                className="mt-3 text-sm font-medium text-gold hover:text-gold-bright"
              >
                再読み込み
              </button>
            </div>
          ) : boxState ? (
            <>
              {/* 現在の箱：VIPルーム風・漆黒ピアノブラック・ゴールド金具・カジノチケット・スポットライト・パーティクル */}
              <section className="ichiban-lottery-container mt-6 overflow-hidden rounded-2xl p-6">
                <div className="ichiban-box-title-wrap text-center">
                  <h2 className="ichiban-box-title text-sm font-semibold uppercase tracking-wider">現在の箱</h2>
                </div>
                <p className="ichiban-box-info mt-1 text-center text-xs">1枚＝100チップ</p>
                <div className="relative mx-auto mt-6 w-full max-w-xs">
                  {/* 金粉・光の粒パーティクル */}
                  <div className="ichiban-particles" aria-hidden>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <span
                        key={i}
                        className="ichiban-particle"
                        style={{
                          left: `${15 + (i * 11) % 70}%`,
                          top: `${20 + (i * 13) % 60}%`,
                          animationDelay: `${i * 0.7}s`,
                        }}
                      />
                    ))}
                  </div>
                  {/* 抽選箱：パース・内壁（底面・側面）・角金具ハイライト・チケットは底に溜まる */}
                  <div
                    className="ichiban-lottery-box relative mx-auto h-44 w-52 overflow-hidden rounded-b-lg rounded-t-sm"
                    style={{
                      perspective: '420px',
                      transform: 'rotateX(14deg) rotateZ(-1deg)',
                    }}
                  >
                    <div className="ichiban-box-corner ichiban-box-corner-tl rounded-tl" />
                    <div className="ichiban-box-corner ichiban-box-corner-tr rounded-tr" />
                    <div className="ichiban-box-corner ichiban-box-corner-bl rounded-bl" />
                    <div className="ichiban-box-corner ichiban-box-corner-br rounded-br" />
                    {/* 内壁：底面（チケットが溜まっている床） */}
                    <div
                      className="absolute left-2 right-2 bottom-0 z-0 h-6 rounded-b-sm"
                      style={{
                        background: 'linear-gradient(180deg, rgba(14,14,16,0.95) 0%, rgba(6,6,8,0.98) 100%)',
                        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
                      }}
                    />
                    {/* 内壁：左側面 */}
                    <div
                      className="absolute left-0 bottom-0 top-0 z-0 w-2.5 rounded-l-sm opacity-90"
                      style={{
                        background: 'linear-gradient(90deg, rgba(22,22,24,0.98) 0%, rgba(10,10,12,0.95) 100%)',
                        boxShadow: 'inset 2px 0 10px rgba(0,0,0,0.5)',
                      }}
                    />
                    {/* 内壁：右側面 */}
                    <div
                      className="absolute right-0 bottom-0 top-0 z-0 w-2.5 rounded-r-sm opacity-90"
                      style={{
                        background: 'linear-gradient(270deg, rgba(22,22,24,0.98) 0%, rgba(10,10,12,0.95) 100%)',
                        boxShadow: 'inset -2px 0 10px rgba(0,0,0,0.5)',
                      }}
                    />
                    <div
                      className="pointer-events-none absolute inset-0 rounded-b-lg rounded-t-sm"
                      style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 25%, transparent 65%, rgba(0,0,0,0.4) 100%)',
                      }}
                    />
                    <div className="absolute inset-3 z-10 flex items-end justify-center overflow-hidden rounded-sm" style={{ bottom: '1.5rem' }}>
                      {TICKET_ROTATIONS.slice(0, 26).map((rot, i) => {
                        const isTopTicket = i === 25;
                        return (
                          <div
                            key={i}
                            className={`ichiban-ticket-casino ${isTopTicket ? 'ichiban-ticket-top' : ''}`}
                            style={{
                              left: `calc(50% - 12px + ${(i % 5) * 10 - 20}px + ${(i % 3) * 5}px)`,
                              bottom: `${Math.floor(i / 5) * 8 + 4}px`,
                              transform: `rotate(${rot}deg)`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <span className="ichiban-box-count text-3xl font-extrabold">{boxState.remainingCount}</span>
                    <span className="ichiban-box-count-unit ml-1">枚</span>
                  </div>
                </div>
              </section>

              {/* 景品ボード：特賞が上段2列幅、その下2×3の6マス */}
              <section className="mt-6 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5 shadow-lg">
                <h2 className="text-base font-semibold text-white">景品ボード</h2>
                <p className="mt-1 text-xs text-zinc-500">200枚目でラストワン賞（エターナル・クロスの欠片×3）</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {/* 特賞：VIP プラチナゴールド・シャイン・特等は光の粒子 */}
                  {(() => {
                    const key = 'grand_prize';
                    const count = boxState.remainingByPrize[key] ?? 0;
                    const isEnded = count === 0;
                    return (
                      <div
                        key={key}
                        className={`col-span-2 relative px-4 py-3 transition ichiban-card-vip ichiban-card-grand-prize ${isEnded ? 'ichiban-stamp-ended' : ''}`}
                      >
                        {!isEnded && (
                          <div className="ichiban-prize-particles" aria-hidden>
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <span key={n} className="ichiban-prize-particle" />
                            ))}
                          </div>
                        )}
                        <p className="ichiban-prize-label text-white/95">特等</p>
                        <p className="mt-1 line-clamp-2 text-sm text-white/90">
                          {PRIZE_LABELS[key]?.replace(/^[^：]+：/, '') ?? key}
                        </p>
                        <p className="mt-2 text-right">
                          <span className="ichiban-prize-count-badge">{count}本</span>
                        </p>
                      </div>
                    );
                  })()}
                  {/* その他6賞：A・B+=銀VIP（特賞同エフェクト）、B-=シルバー、C/D=スタンダード */}
                  {(['a', 'b_plus', 'b_minus', 'c', 'd_plus', 'd'] as const).map((key) => {
                    const count = boxState.remainingByPrize[key] ?? 0;
                    const isEnded = count === 0;
                    const isSilverVip = key === 'a' || key === 'b_plus';
                    const isSilver = key === 'b_minus';
                    const isStandard = key === 'c' || key === 'd_plus' || key === 'd';
                    const shapeClass = isSilverVip ? 'ichiban-card-vip-silver' : isSilver ? 'ichiban-card-silver' : 'ichiban-card-standard';
                    const label = key === 'a' ? 'A賞' : key.toUpperCase().replace('_', ' ');
                    return (
                      <div
                        key={key}
                        className={`relative px-3 py-3 transition ${shapeClass} ${isSilverVip ? 'ichiban-card-has-particles' : ''} ${isEnded ? 'ichiban-stamp-ended' : ''}`}
                      >
                        {!isEnded && isSilverVip && (
                          <div className="ichiban-prize-particles" aria-hidden>
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <span key={n} className="ichiban-prize-particle" />
                            ))}
                          </div>
                        )}
                        <p className={`ichiban-prize-label ${isSilverVip ? 'text-white/95' : 'text-zinc-300'}`}>
                          {label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-zinc-200">
                          {PRIZE_LABELS[key]?.replace(/^[^：]+：/, '') ?? key}
                        </p>
                        <p className="mt-2 text-right">
                          <span className="ichiban-prize-count-badge">{count}本</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* プレイ（所持チップ強調・1枚引くは文字読める・残り全部買いは控えめ） */}
              <section className="mt-6 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-6 shadow-lg">
                <h2 className="text-base font-semibold text-white">プレイ</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  所持チップ: <span className="text-xl font-bold" style={{ color: '#ffeb3b' }}>{gems ?? '—'}</span>
                </p>
                {typeof gems === 'number' && gems >= 500 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-zinc-500">枚数:</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setDrawCount(n)}
                        disabled={drawLoading || (gems ?? 0) < n * 100 || (boxState?.remainingCount ?? 0) < n}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
                          drawCount === n
                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                            : 'border-zinc-600 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800'
                        }`}
                      >
                        {n}枚
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleDrawOne}
                    disabled={drawLoading || boxState.remainingCount === 0 || (gems !== null && gems < drawCount * 100)}
                    className="ichiban-btn-draw relative overflow-hidden rounded-xl border-2 border-amber-600/70 bg-gradient-to-b from-amber-600/90 to-amber-800/95 py-4 shadow-lg transition hover:from-amber-500/95 hover:to-amber-700/95 disabled:opacity-50 disabled:hover:from-amber-600/90 disabled:hover:to-amber-800/95"
                  >
                    <span>{drawLoading ? '引いています…' : `${drawCount}枚引く（${drawCount * 100}チップ）`}</span>
                  </button>
                </div>
                <div className="mt-6 border-t border-zinc-700/80 pt-4">
                  <button
                    type="button"
                    onClick={handleBuyAll}
                    disabled={
                      drawLoading ||
                      boxState.remainingCount === 0 ||
                      (gems !== null && gems < boxState.remainingCount * 100)
                    }
                    className="w-full rounded-xl border border-zinc-600 bg-zinc-800/50 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-700/70 hover:text-zinc-400 disabled:opacity-50"
                  >
                    {drawLoading
                      ? '処理中…'
                      : `残り全部買う（${boxState.remainingCount * 100}チップ）`}
                  </button>
                </div>
              </section>

              {/* 直近の結果（モーダル以外で表示） */}
              {lastResult && !peelModal && (
                <section className="mt-6 rounded-2xl border border-zinc-700 bg-amber-950/20 p-6 shadow-lg">
                  <h2 className="text-base font-semibold text-[var(--gold)]">結果</h2>
                  {lastResult.prizeType && (
                    <p className="mt-3 text-lg text-white">
                      {lastResult.prizeType === 'grand_prize' ? (
                        <span className="ichiban-prize-shine font-bold">
                          {PRIZE_LABELS[lastResult.prizeType]}
                        </span>
                      ) : (
                        PRIZE_LABELS[lastResult.prizeType]
                      )}
                      {lastResult.isLastOne && (
                        <span className="ml-2 rounded-full bg-[var(--gold)]/20 px-3 py-1 text-sm font-medium text-[var(--gold)]">
                          ラストワン賞付き
                        </span>
                      )}
                    </p>
                  )}
                  {lastResult.drawnCount != null && lastResult.prizeCounts && (
                    <div className="mt-4">
                      <p className="text-sm text-zinc-400">{lastResult.drawnCount}枚引きました。</p>
                      <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
                        {Object.entries(lastResult.prizeCounts).map(([key, n]) => {
                          if (n === 0) return null;
                          return (
                            <li key={key}>
                              {PRIZE_LABELS[key] ?? key} × {n}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </section>
              )}
            </>
          ) : null}

          <p className="mt-8 pb-4 text-center">
            <Link href={eventListHref} className="text-sm text-gold hover:text-gold-bright">
              ← イベント一覧へ
            </Link>
          </p>
        </div>
      </main>

      {/* クジが箱から手前に飛んでくるアニメーション */}
      {flyPhase === 'flying' && resultQueue.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          style={{ pointerEvents: 'none' }}
          aria-hidden
        >
          <div
            className="ichiban-ticket-flying ichiban-ticket-hologram absolute left-1/2 top-1/2 h-32 w-48 rounded-lg"
            style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
            onAnimationEnd={handleFlyingTicketEnd}
          />
        </div>
      )}

      {/* めくりモーダル：くじの裏→クリックで裏返して賞表示 */}
      {peelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={peelPhase === 'idle' ? handlePeelClick : undefined}
          role="dialog"
          aria-modal="true"
          aria-label="くじの結果"
        >
          <div
            className="relative w-full max-w-sm"
            style={{ perspective: '1200px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`ichiban-ticket-inner relative h-48 w-full rounded-2xl ${peelPhase !== 'idle' ? 'revealed' : ''}`}
              onClick={peelPhase === 'idle' ? handlePeelClick : undefined}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (peelPhase === 'idle' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handlePeelClick(); } }}
            >
              {/* 裏面：くじの裏（ゴールド・厚紙風） */}
              <div
                className="ichiban-ticket-back absolute inset-0 rounded-2xl border-2 border-[var(--gold-dark)]"
                style={{
                  background: 'linear-gradient(155deg, #5c4a0f 0%, #8b6914 25%, #a68b20 50%, #8b6914 75%, #4a3808 100%)',
                  boxShadow: 'inset 0 2px 12px rgba(255,255,255,0.08), inset 0 -2px 8px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.5)',
                }}
              >
                <div className="flex h-full flex-col items-center justify-center px-6">
                  {peelPhase === 'idle' && (
                    <>
                      <p className="text-center text-sm font-medium text-amber-200/80">タップしてめくる</p>
                      <p className="mt-2 text-center text-xs text-amber-900/70">Tap to reveal</p>
                    </>
                  )}
                </div>
              </div>
              {/* 表面：賞名（光って出現） */}
              <div
                className="ichiban-ticket-front absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-[var(--gold)]/50 bg-gradient-to-br from-zinc-900 to-black px-6"
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,162,39,0.2)',
                }}
              >
                {peelPhase !== 'idle' && (
                  <div
                    className="text-center"
                    style={{
                      animation: 'ichiban-reveal-glow 0.6s ease-out forwards',
                    }}
                  >
                    <p className="text-xs font-medium uppercase text-zinc-500">
                      {peelModal.prizeType === 'grand_prize' ? '特等' : peelModal.prizeType}
                    </p>
                    <p className={`mt-2 text-lg font-bold sm:text-xl ${peelModal.prizeType === 'grand_prize' ? 'ichiban-prize-shine' : 'text-white'}`}>
                      {PRIZE_LABELS[peelModal.prizeType] ?? peelModal.prizeType}
                    </p>
                    {peelModal.isLastOne && (
                      <p className="mt-2 text-sm font-medium text-[var(--gold)]">ラストワン賞付き</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
