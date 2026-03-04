'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';
import { BOARD_SPACES, getSpace } from '@/lib/sugoroku-board';
import { getCurrentWeekRange } from '@/lib/weekly-events';

type State = {
  position: number;
  diceCount: number;
  lapCount: number;
  fragments: number;
  eventXp: number;
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
  const [useGoldenDice, setUseGoldenDice] = useState<number | null>(null);

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
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchState().finally(() => setLoading(false));
  }, [fetchState, previewQuery]);

  const handleRoll = async () => {
    if (!state || rollLoading) return;
    if (state.diceCount < 1 && (useGoldenDice === null || state.goldenDiceCount < 1)) {
      setError('サイコロがありません。17番ショップで購入するか、100チップで1個買えます。');
      return;
    }
    setRollLoading(true);
    setLastRoll(null);
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
    if (state && state.eventXp < amount * 10) {
      setError(`全共通XPが足りません（10 全共通XP = 1 チップ）。所持: ${state.eventXp}`);
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
      setState((s) => s ? { ...s, eventXp: data.newEventXp, gems: data.newGems } : s);
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
      <div className="flex min-h-screen flex-col bg-black">
        <AppHeader backHref={eventListHref} />
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <LoadingWithPercent className="ml-3 text-zinc-400" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="flex min-h-screen flex-col bg-black">
        <AppHeader backHref={eventListHref} />
        <main className="flex flex-1 flex-col items-center justify-center p-4">
          <p className="text-amber-400">{error}</p>
          <Link href={eventListHref} className="mt-4 text-sm text-gold">← イベントへ</Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  const s = state!;
  const currentSpace = getSpace(s.position);

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <AppHeader backHref={eventListHref} />
      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <h1 className="text-xl font-bold text-white">運命のすごろく</h1>
        <p className="mt-1 text-xs text-zinc-500">イベント終了: {weekEndStr}（月曜0時）・借金は免除されます</p>
        <p className="mt-1 text-xs text-zinc-500">イベントXP＝全共通XP（ゲーム内共通経験値）。欠片10個でエターナル素材1個。18番で欠片+1。10周・20周で欠片+1ボーナス。</p>

        {/* 枡目・サイコロ・周回（ゲーム情報として前面に） */}
        <div className="mt-4 rounded-xl border border-amber-700/60 bg-zinc-900/90 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">現在地</p>
          <p className="mt-0.5 text-lg font-bold text-white">
            {s.position}番マス — {currentSpace?.name ?? '???'}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <div>
              <p className="text-[10px] text-zinc-500">サイコロ</p>
              <p className="text-xl font-bold text-amber-400">{s.diceCount} 個</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500">周回</p>
              <p className="text-xl font-bold text-white">{s.lapCount} 周目</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500">欠片</p>
              <p className="text-xl font-bold text-gold">{s.fragments}/10</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-400">全共通XP <span className="font-bold text-white">{s.eventXp}</span></span>
            <span className="text-zinc-400">チップ <span className={`font-bold ${s.gems < 0 ? 'text-red-400' : 'text-amber-400'}`}>{s.gems}</span></span>
            {s.trapGuard && <span className="rounded bg-amber-900/50 px-2 py-0.5 text-amber-300">トラップガード</span>}
            {s.goldenDiceCount > 0 && <span className="rounded bg-gold/20 px-2 py-0.5 text-gold">黄金のダイス ×{s.goldenDiceCount}</span>}
          </div>
        </div>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        {/* RPG風・出来事（会話）表示 */}
        {lastRoll && (
          <div className="mt-4 rounded-xl border-2 border-amber-600/50 bg-black/70 p-4 shadow-inner" role="region" aria-label="出来事">
            <p className="text-[10px] uppercase tracking-wider text-amber-500/90">— 出来事 —</p>
            <p className="mt-2 text-sm leading-relaxed text-amber-100">
              サイコロは <span className="font-bold text-amber-300">{lastRoll.steps}</span> を出した。
              <span className="font-semibold text-white"> {currentSpace?.name ?? `${s.position}番`}</span> に止まった。
            </p>
            {lastRoll.messages.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-amber-700/40 pt-3">
                {lastRoll.messages.map((m, i) => (
                  <p key={i} className="text-sm text-amber-100/95">「{m}」</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ロール */}
        <div className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
          <p className="text-sm text-zinc-400">サイコロを振って進もう</p>
          {s.goldenDiceCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">黄金のダイスで出目指定:</span>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setUseGoldenDice(useGoldenDice === n ? null : n)}
                  className={`rounded border px-2 py-1 text-sm ${useGoldenDice === n ? 'border-gold bg-gold/30 text-gold' : 'border-zinc-600 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleRoll}
            disabled={rollLoading || (s.diceCount < 1 && useGoldenDice === null)}
            className="mt-3 w-full rounded-lg bg-amber-600 py-3 font-bold text-black hover:bg-amber-500 disabled:opacity-50"
          >
            {rollLoading ? '処理中…' : useGoldenDice !== null ? `黄金のダイスで ${useGoldenDice} を出す` : 'サイコロを振る'}
          </button>
        </div>

        {/* 17番にいるときショップ */}
        {s.position === 17 && (
          <button
            type="button"
            onClick={openShop}
            disabled={!s.canUseShop}
            className="mt-3 w-full rounded-lg border border-gold-subtle bg-[var(--gold)]/20 py-2 text-gold disabled:opacity-50"
          >
            ディーラーズ・ショップに入る（時価 0.5〜2.5倍）
          </button>
        )}

        {/* 換金 */}
        <div className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
          <p className="text-sm text-zinc-400">10 全共通XP = 1 チップ（いつでも換金可能）</p>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              min={1}
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              placeholder="得るチップ数"
              className="flex-1 rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500"
            />
            <button
              type="button"
              onClick={handleConvert}
              disabled={convertLoading || !convertAmount}
              className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-gold disabled:opacity-50"
            >
              換金
            </button>
          </div>
        </div>

        {/* 盤面一覧 */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-400">盤面（全36枡目）</h2>
          <ul className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-6">
            {BOARD_SPACES.map((sp) => (
              <li
                key={sp.num}
                className={`rounded border p-2 text-center ${
                  sp.num === s.position
                    ? 'border-amber-500 bg-amber-500/20'
                    : sp.num === 17 || sp.num === 18 || sp.num === 19
                    ? 'border-gold-subtle bg-zinc-800/80'
                    : 'border-zinc-700 bg-zinc-900/50'
                }`}
              >
                <p className="text-[10px] font-bold text-zinc-400">{sp.num}</p>
                <p className="truncate text-[10px] text-white">{sp.name}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-center">
          <Link href={eventListHref} className="text-sm text-gold hover:underline">← イベント一覧へ</Link>
        </p>
      </main>

      {/* ショップモーダル */}
      {shopOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 sm:items-center"
          onClick={() => setShopOpen(false)}
        >
          <div
            className="w-full max-h-[80vh] overflow-y-auto rounded-t-2xl border border-gold-subtle bg-zinc-900 p-4 sm:max-w-md sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">ディーラーズ・ショップ</h3>
            <p className="mt-1 text-sm text-zinc-500">所持チップ: {shopGems}</p>
            <ul className="mt-4 space-y-3">
              {shopItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-700 p-3">
                  <span className="text-sm text-white">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">{item.price} チップ</span>
                    <button
                      type="button"
                      onClick={() => handleBuy(item.id, item.price)}
                      disabled={shopGems < item.price}
                      className="rounded bg-amber-600 px-3 py-1 text-sm font-medium text-black disabled:opacity-50"
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
              className="mt-4 w-full rounded-lg border border-zinc-600 py-2 text-zinc-400"
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
