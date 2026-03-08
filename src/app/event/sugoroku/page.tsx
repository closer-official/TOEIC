'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';
import { SugorokuDice } from '@/components/SugorokuDice';
import { BOARD_SPACES, getSpace, type SpaceKind } from '@/lib/sugoroku-board';
import { getCurrentWeekRange } from '@/lib/weekly-events';

/** 蛇行盤: 行r・列c のマス番号（1〜36） */
function snakeCellNum(r: number, c: number): number {
  return r % 2 === 0 ? r * 6 + c + 1 : r * 6 + (5 - c) + 1;
}

function spaceKindClass(kind: SpaceKind): string {
  const m: Record<SpaceKind, string> = {
    start: 'sugoroku-space-start',
    neon: '',
    hell_slippery: 'sugoroku-space-hell',
    dice_gem: '',
    buffet: '',
    straight: '',
    shop: 'sugoroku-space-shop',
    eternal_altar: 'sugoroku-space-eternal',
    black_hole: 'sugoroku-space-hell',
    luxury: 'sugoroku-space-luxury',
    trap_guard: 'sugoroku-space-trap',
    gambling: 'sugoroku-space-gambling',
    last_gamble: 'sugoroku-space-last',
  };
  return m[kind] ?? '';
}

type State = {
  position: number;
  diceCount: number;
  lapCount: number;
  fragments: number;
  eventXp: number;
  /** 全共通XP（profiles.evolution_points）。表示・換金に使用 */
  commonXp?: number;
  trapGuard: boolean;
  goldenDiceCount: number;
  gems: number;
  shopMultiplier: number | null;
  canUseShop: boolean;
};

function SugorokuEventContent() {
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === '1' || searchParams.get('dev') === '1';
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollLoading, setRollLoading] = useState(false);
  const [lastRoll, setLastRoll] = useState<{ steps: number; messages: string[]; spaceName?: string } | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopItems, setShopItems] = useState<{ id: string; name: string; basePrice: number; price: number }[]>([]);
  const [shopGems, setShopGems] = useState(0);
  const [convertAmount, setConvertAmount] = useState('');
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertFragmentLoading, setConvertFragmentLoading] = useState(false);
  const [useGoldenDice, setUseGoldenDice] = useState<number | null>(null);
  const [rollResult, setRollResult] = useState<number | null>(null);

  const postHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isPreview) postHeaders['X-Preview'] = '1';
  const previewQuery = isPreview ? '?preview=1' : '';

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/event/sugoroku${previewQuery}`, { credentials: 'include' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '状態の取得に失敗しました');
      setState(null);
      return;
    }
    const data = await res.json();
    setState(data);
    setError(null);
  }, [previewQuery]);

  useEffect(() => {
    setLoading(true);
    fetchState().finally(() => setLoading(false));
  }, [fetchState, previewQuery]);

  const handleRoll = async () => {
    if (!state || rollLoading) return;
    if (state.diceCount < 1 && (useGoldenDice === null || state.goldenDiceCount < 1)) {
      setError('サイコロがありません。毎日ログインで3個もらえます。17番ショップで100チップで1個購入可能。');
      return;
    }
    setRollLoading(true);
    setLastRoll(null);
    setRollResult(null);
    setError(null);
    try {
      const body = useGoldenDice !== null && useGoldenDice >= 1 && useGoldenDice <= 6
        ? { useGoldenDice }
        : {};
      const res = await fetch('/api/event/sugoroku/roll', {
        method: 'POST',
        headers: postHeaders,
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'ロールに失敗しました');
        return;
      }
      setRollResult(data.steps);
      setLastRoll({
        steps: data.steps,
        messages: data.messages ?? [],
        spaceName: data.spaceName,
      });
      setState({
        position: data.position,
        diceCount: data.diceCount,
        lapCount: data.lapCount,
        fragments: data.fragments,
        eventXp: data.eventXp,
        commonXp: data.commonXp,
        trapGuard: data.trapGuard,
        goldenDiceCount: data.goldenDiceCount,
        gems: data.gems,
        shopMultiplier: state.shopMultiplier,
        canUseShop: data.canUseShop,
      });
      setUseGoldenDice(null);
    } finally {
      setRollLoading(false);
    }
  };

  const openShop = async () => {
    if (!state?.canUseShop) {
      setError('借金中はショップを利用できません。');
      return;
    }
    const res = await fetch(`/api/event/sugoroku/shop${previewQuery}`, { credentials: 'include' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'ショップを開けません');
      return;
    }
    const data = await res.json();
    setShopItems(data.items ?? []);
    setShopGems(data.gems ?? 0);
    setShopOpen(true);
  };

  const handleBuy = async (itemId: string, price: number) => {
    const res = await fetch('/api/event/sugoroku/shop', {
      method: 'POST',
      headers: postHeaders,
      credentials: 'include',
      body: JSON.stringify({ itemId, quantity: 1 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? '購入に失敗しました');
      return;
    }
    setState((s) => s ? { ...s, gems: data.newGems, canUseShop: data.newGems >= 0, diceCount: data.diceCount ?? s.diceCount, goldenDiceCount: data.goldenDiceCount ?? s.goldenDiceCount } : s);
    setShopGems(data.newGems ?? shopGems);
    setShopOpen(false);
    fetchState();
  };

  const handleConvert = async () => {
    const amount = Math.floor(Number(convertAmount));
    if (amount < 1) {
      setError('1以上のチップ数を入力してください');
      return;
    }
    const commonXp = state?.commonXp ?? state?.eventXp ?? 0;
    if (state && commonXp < amount * 10) {
      setError(`全共通XPが足りません（10 全共通XP = 1 チップ）。所持: ${commonXp}`);
      return;
    }
    setConvertLoading(true);
    setError(null);
    try {
    const res = await fetch('/api/event/sugoroku/convert', {
      method: 'POST',
      headers: postHeaders,
      credentials: 'include',
      body: JSON.stringify({ amount }),
    });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? '換金に失敗しました');
        return;
      }
      setConvertAmount('');
      setState((s) => s ? { ...s, commonXp: data.newCommonXp, gems: data.newGems } : s);
      fetchState();
    } finally {
      setConvertLoading(false);
    }
  };

  const { start, end } = getCurrentWeekRange();
  const weekEndStr = `${end.getMonth() + 1}/${end.getDate()} ${end.getHours()}:00`;

  const eventListHref = isPreview ? '/event?preview=1' : '/event';
  if (loading) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <AppHeader backHref={eventListHref} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)]/70 border-t-transparent" />
          <LoadingWithPercent className="text-zinc-400" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <AppHeader backHref={eventListHref} />
        <main className="min-h-0 flex-1 overflow-y-auto content-below-header safe-area-pad px-4 sm:px-6">
          <div className="mx-auto max-w-2xl pt-4">
            <div className="rounded-2xl border border-red-800/50 bg-red-950/30 px-5 py-4">
              <p className="text-sm text-red-200">{error}</p>
              <Link href={eventListHref} className="mt-3 inline-block text-sm font-medium text-gold hover:text-gold-bright">← イベント一覧へ</Link>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const s = state!;
  const currentSpace = getSpace(s.position);
  const tickerText = `【運命のすごろく】サイコロで進んで報酬GET　17番でディーラーズ・ショップ　エターナルのかけら10個でエターナル素材に変換　`;

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black sugoroku-bg">
      <AppHeader backHref={eventListHref} />

      <div className="event-ticker-wrap">
        <div className="event-ticker-track">
          <span>{tickerText.repeat(4)}</span>
        </div>
      </div>

      <main
        className="min-h-0 flex-1 overflow-y-auto content-below-header safe-area-pad px-3 sm:px-4"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto max-w-2xl">
          <header className="pt-3 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="event-title-wrap text-xl font-bold tracking-tight sm:text-2xl">
                <span className="event-title-gold">運命のすごろく</span>
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">終了: {weekEndStr}（月曜0時）</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-black/40 border border-amber-700/40 px-2.5 py-1 text-xs text-amber-200">
                出目<span className="ml-1 font-bold text-white">{s.diceCount}</span>
              </span>
              <span className="rounded-full bg-black/40 border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300">周回 <span className="font-semibold text-white">{s.lapCount}</span></span>
              <span className="rounded-full bg-black/40 border border-amber-600/50 px-2.5 py-1 text-xs text-gold">欠片 <span className="font-semibold">{s.fragments}/10</span></span>
              <span className="rounded-full bg-black/40 border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300">全共通XP <span className="font-semibold text-white">{(s.commonXp ?? s.eventXp).toLocaleString()}</span></span>
              <span className={`rounded-full border px-2.5 py-1 text-xs ${s.gems < 0 ? 'bg-red-950/50 border-red-700/50 text-red-200' : 'bg-amber-950/30 border-amber-700/40 text-amber-200'}`}>チップ <span className="font-semibold">{s.gems}</span></span>
              {s.trapGuard && <span className="rounded-full bg-emerald-950/50 border border-emerald-700/40 px-2.5 py-1 text-xs text-emerald-200">ガード</span>}
              {s.goldenDiceCount > 0 && <span className="rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/40 px-2.5 py-1 text-xs text-gold">黄金×{s.goldenDiceCount}</span>}
            </div>
          </header>

          {/* 現在地ラベル */}
          <p className="mt-2 text-center text-sm text-amber-200/95">
            現在: <span className="font-bold text-amber-100">{s.position}番</span> — {currentSpace?.name ?? '???'}
          </p>

          {/* 盤面（蛇行6×6） */}
          <section className="mt-4" aria-label="盤面">
            <div className="sugoroku-board-wrap">
              <div className="sugoroku-board">
                {[0, 1, 2, 3, 4, 5].map((r) =>
                  [0, 1, 2, 3, 4, 5].map((c) => {
                    const num = snakeCellNum(r, c);
                    const sp = BOARD_SPACES[num - 1];
                    const isCurrent = sp.num === s.position;
                    const kindClass = spaceKindClass(sp.kind);
                    return (
                      <div
                        key={num}
                        className={`sugoroku-space ${kindClass} ${isCurrent ? 'sugoroku-space-current' : ''}`}
                        aria-current={isCurrent ? 'location' : undefined}
                      >
                        <span className="sugoroku-space-num">{num}</span>
                        <span className="sugoroku-space-name">{sp.name}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-800/50 bg-red-950/30 px-5 py-4 sugoroku-toast">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* 直近の出来事（トースト風） */}
          {lastRoll && (
            <div className="mt-4 rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 sugoroku-toast" aria-label="出来事">
              <p className="text-sm text-amber-100/95">
                出目 <span className="font-bold text-amber-300">{lastRoll.steps}</span> → <span className="font-semibold text-white">{currentSpace?.name ?? `${s.position}番`}</span>
              </p>
              {lastRoll.messages.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-amber-700/40 pt-2">
                  {lastRoll.messages.map((m, i) => (
                    <li key={i} className="text-xs text-amber-100/90">「{m}」</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* サイコロを振る（タップで振れる） */}
          <section className="event-section mt-5 p-4">
            <h2 className="text-sm font-semibold text-white">サイコロを振る</h2>
            {s.goldenDiceCount > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">黄金で出目指定:</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setUseGoldenDice(useGoldenDice === n ? null : n)}
                      className={`min-w-[2.5rem] rounded-lg border py-1.5 text-sm font-medium transition-colors ${
                        useGoldenDice === n ? 'border-[var(--gold)] bg-[var(--gold)]/30 text-gold' : 'border-zinc-600 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-col items-center gap-3">
              <SugorokuDice
                isRolling={rollLoading}
                result={rollResult}
                onTap={handleRoll}
                disabled={s.diceCount < 1 && useGoldenDice === null}
                goldenValue={useGoldenDice}
              />
              <p className="text-xs text-zinc-500">
                {rollLoading ? '振っています…' : s.diceCount < 1 && useGoldenDice === null ? 'サイコロがありません（毎日ログインで3個／100チップで1個）' : 'タップして振る'}
              </p>
              <button
                type="button"
                onClick={handleRoll}
                disabled={rollLoading || (s.diceCount < 1 && useGoldenDice === null)}
                className="event-btn-primary w-full max-w-xs text-base text-black"
              >
                {rollLoading ? '処理中…' : useGoldenDice !== null ? `黄金のダイスで ${useGoldenDice} を出す` : 'ボタンで振る'}
              </button>
            </div>
          </section>

          {s.position === 17 && (
            <button
              type="button"
              onClick={openShop}
              disabled={!s.canUseShop}
              className="mt-4 w-full rounded-xl border-2 border-[var(--gold)]/50 bg-[var(--gold)]/15 py-3 font-semibold text-gold transition hover:bg-[var(--gold)]/25 disabled:opacity-50"
            >
              ディーラーズ・ショップ（17番・時価変動）
            </button>
          )}

          {/* 換金・欠片変換 */}
          <section className="event-section mt-4 p-4">
            <h2 className="text-sm font-semibold text-white">XP → チップ換金</h2>
            <p className="mt-0.5 text-xs text-zinc-500">10 全共通XP = 1 チップ</p>
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                min={1}
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                placeholder="チップ数"
                className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-white placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 text-base"
              />
              <button type="button" onClick={handleConvert} disabled={convertLoading || !convertAmount} className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2.5 font-medium text-gold disabled:opacity-50">
                換金
              </button>
            </div>
            {s.fragments >= 10 && (
              <div className="mt-3 pt-3 border-t border-zinc-700">
                <button
                  type="button"
                  disabled={convertFragmentLoading}
                  onClick={async () => {
                    setConvertFragmentLoading(true);
                    setError(null);
                    try {
                      const res = await fetch(`/api/event/sugoroku/convert-fragments${previewQuery}`, { method: 'POST', credentials: 'include' });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) setError(data.error ?? '変換に失敗しました');
                      else await fetchState();
                    } finally {
                      setConvertFragmentLoading(false);
                    }
                  }}
                  className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
                >
                  {convertFragmentLoading ? '変換中...' : '10個でエターナル素材に変換'}
                </button>
              </div>
            )}
          </section>

          <p className="mt-6 pb-8 text-center">
            <Link href={eventListHref} className="text-sm text-gold hover:text-gold-bright">← イベント一覧へ</Link>
          </p>
        </div>
      </main>

      {/* ショップモーダル */}
      {shopOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/80 sm:items-center"
          onClick={() => setShopOpen(false)}
        >
          <div
            className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:max-w-md sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white">ディーラーズ・ショップ</h3>
            <p className="mt-2 rounded-full bg-amber-950/50 px-3 py-1 text-sm text-amber-300 inline-block">所持: <span className="font-bold">{shopGems}</span> チップ</p>
            <ul className="mt-5 space-y-3">
              {shopItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-800/80 p-4">
                  <span className="text-sm font-medium text-white">{item.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-amber-400 font-semibold">{item.price}</span>
                    <button
                      type="button"
                      onClick={() => handleBuy(item.id, item.price)}
                      disabled={shopGems < item.price}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
                    >
                      購入
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShopOpen(false)}
              className="mt-5 w-full rounded-xl border border-zinc-600 py-3 text-zinc-400 hover:bg-zinc-800"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function SugorokuEventPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col bg-black">
        <AppHeader backHref="/event" />
        <main className="flex flex-1 items-center justify-center p-4">
          <LoadingWithPercent className="text-zinc-500" />
        </main>
        <BottomNav />
      </div>
    }>
      <SugorokuEventContent />
    </Suspense>
  );
}
