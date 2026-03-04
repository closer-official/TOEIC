'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';
import { TOWER_ELEVATORS, TOWER_ITEMS, type TowerElevatorId } from '@/lib/tower-event';

type TowerState = {
  currentFloor: number;
  floorXp: number;
  gems: number;
  goldenOilActive: boolean;
  shockMatCount: number;
  masterKeyFloorsLeft: number;
  climate: { id: string; name: string; effect: string };
  climateNextChangeMs: number;
  ghostXpAtFloor: number;
  costVip: number;
  costVipClimate: number;
  costRisk: number;
  costTechnical: number;
  riskSuccessPct: number;
};

export default function TowerEventPage() {
  const [state, setState] = useState<TowerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rideLoading, setRideLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string; ghostCollected?: number; fallFloors?: number } | null>(null);
  const [useGoldenOil, setUseGoldenOil] = useState(false);
  const [useShockMat, setUseShockMat] = useState(false);
  const [useMasterKey, setUseMasterKey] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopLoading, setShopLoading] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch('/api/event/tower', { credentials: 'include' });
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
  }, [fetchState]);

  const handleRide = async (elevator: TowerElevatorId) => {
    if (!state || rideLoading) return;
    const cost =
      elevator === 'vip'
        ? (state.masterKeyFloorsLeft > 0 && useMasterKey ? Math.floor(state.costVipClimate * 0.7) : state.costVipClimate)
        : elevator === 'risk'
          ? state.costRisk
          : state.costTechnical;
    if (state.gems < cost) {
      setError(`チップが足りません（必要: ${cost}）`);
      return;
    }
    setRideLoading(true);
    setLastResult(null);
    setError(null);
    try {
      const res = await fetch('/api/event/tower/ride', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          elevator,
          useGoldenOil: elevator === 'risk' ? useGoldenOil : false,
          useShockMat: elevator === 'risk' ? useShockMat : false,
          useMasterKey: elevator === 'vip' ? useMasterKey : false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? '乗車に失敗しました');
        return;
      }
      setLastResult({
        success: data.success,
        message: data.message,
        ghostCollected: data.ghostCollected,
        fallFloors: data.fallFloors,
      });
      if (elevator === 'risk') setUseGoldenOil(false);
      if (elevator === 'vip') setUseMasterKey(false);
      await fetchState();
    } finally {
      setRideLoading(false);
    }
  };

  const handleBuy = async (itemId: 'golden_oil' | 'shock_mat' | 'master_key') => {
    if (!state || shopLoading) return;
    const item = TOWER_ITEMS[itemId];
    if (state.gems < item.price) {
      setError(`${item.name}は${item.price}チップ必要です`);
      return;
    }
    setShopLoading(itemId);
    setError(null);
    try {
      const res = await fetch('/api/event/tower/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? '購入に失敗しました');
        return;
      }
      setState((s) =>
        s
          ? {
              ...s,
              gems: data.gems,
              goldenOilActive: data.goldenOilActive ?? s.goldenOilActive,
              shockMatCount: data.shockMatCount ?? s.shockMatCount,
              masterKeyFloorsLeft: data.masterKeyFloorsLeft ?? s.masterKeyFloorsLeft,
            }
          : s
      );
    } finally {
      setShopLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <AppHeader backHref="/event" />
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
        <AppHeader backHref="/event" />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>
          <p className="mt-8 text-center text-zinc-400">{error}</p>
          <p className="mt-4 text-center">
            <Link href="/event" className="text-sm text-gold hover:text-gold-bright">← イベント一覧へ</Link>
          </p>
        </main>
        <BottomNav />
      </div>
    );
  }

  const s = state!;

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader backHref="/event" />
      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <h1 className="text-xl font-bold text-white">摩天楼のタワー</h1>
        <p className="mt-1 text-sm text-zinc-500">三択のエレベーターで階層を登ろう</p>

        {error && (
          <div className="mt-3 rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* 状態 */}
        <section className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-zinc-500">現在階</p>
              <p className="text-2xl font-bold text-gold">{s.currentFloor} F</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">階層XP</p>
              <p className="text-lg font-medium text-white">{s.floorXp}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">チップ</p>
              <p className="text-lg font-medium text-gold">{s.gems}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {s.goldenOilActive && <span className="rounded bg-amber-900/50 px-2 py-0.5 text-amber-200">黄金のオイル効果中</span>}
            {s.shockMatCount > 0 && <span className="rounded bg-zinc-700 px-2 py-0.5 text-zinc-300">衝撃吸収×{s.shockMatCount}</span>}
            {s.masterKeyFloorsLeft > 0 && <span className="rounded bg-purple-900/50 px-2 py-0.5 text-purple-200">マスターキー残り{s.masterKeyFloorsLeft}階</span>}
          </div>
          <div className="mt-3 rounded-lg bg-zinc-800/80 px-3 py-2">
            <p className="text-sm font-medium text-zinc-300">塔の気候: {s.climate.name}</p>
            <p className="text-xs text-zinc-500">{s.climate.effect}</p>
            <p className="text-xs text-zinc-600 mt-1">次回変化: {new Date(s.climateNextChangeMs).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          {s.ghostXpAtFloor > 0 && (
            <p className="mt-2 text-sm text-amber-300">👻 この階に遺失XP {s.ghostXpAtFloor} あり（上昇で回収）</p>
          )}
        </section>

        {/* 乗車結果 */}
        {lastResult && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 ${
              lastResult.success ? 'border-emerald-800 bg-emerald-900/30 text-emerald-200' : 'border-amber-800 bg-amber-900/30 text-amber-200'
            }`}
          >
            <p className="font-medium">{lastResult.message}</p>
            {lastResult.ghostCollected != null && lastResult.ghostCollected > 0 && (
              <p className="mt-1 text-sm">遺失XP +{lastResult.ghostCollected} 回収</p>
            )}
          </div>
        )}

        {/* 三択エレベーター */}
        <section className="mt-4">
          <h2 className="text-sm font-medium text-zinc-400">エレベーターを選択</h2>
          <div className="mt-2 space-y-3">
            {/* VIP */}
            <div className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
              <p className="font-medium text-white">{TOWER_ELEVATORS.vip.name}</p>
              <p className="text-xs text-zinc-500">{TOWER_ELEVATORS.vip.failPenalty}</p>
              <p className="mt-1 text-gold">{s.costVipClimate} チップ</p>
              {s.masterKeyFloorsLeft > 0 && (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useMasterKey} onChange={(e) => setUseMasterKey(e.target.checked)} className="rounded" />
                  マスターキー使用（30%オフ → {Math.floor(s.costVipClimate * 0.7)}チップ）
                </label>
              )}
              <button
                type="button"
                onClick={() => handleRide('vip')}
                disabled={rideLoading || s.gems < (useMasterKey && s.masterKeyFloorsLeft > 0 ? Math.floor(s.costVipClimate * 0.7) : s.costVipClimate)}
                className="mt-3 w-full rounded-lg border border-gold-subtle bg-[var(--gold)]/20 py-2 text-sm font-medium text-gold disabled:opacity-50"
              >
                {rideLoading ? '処理中...' : '乗る'}
              </button>
            </div>

            {/* Risk */}
            <div className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
              <p className="font-medium text-white">{TOWER_ELEVATORS.risk.name}</p>
              <p className="text-xs text-zinc-500">成功率 {s.riskSuccessPct}% · 失敗時 {TOWER_ELEVATORS.risk.failPenalty}</p>
              <p className="mt-1 text-gold">{s.costRisk} チップ</p>
              {s.goldenOilActive && (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useGoldenOil} onChange={(e) => setUseGoldenOil(e.target.checked)} className="rounded" />
                  黄金のオイル使用（+20%）
                </label>
              )}
              {s.shockMatCount > 0 && (
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useShockMat} onChange={(e) => setUseShockMat(e.target.checked)} className="rounded" />
                  衝撃吸収マット使用（落下1階軽減）
                </label>
              )}
              <button
                type="button"
                onClick={() => handleRide('risk')}
                disabled={rideLoading || s.gems < s.costRisk}
                className="mt-3 w-full rounded-lg border border-amber-700 bg-amber-900/30 py-2 text-sm font-medium text-amber-200 disabled:opacity-50"
              >
                {rideLoading ? '処理中...' : '乗る'}
              </button>
            </div>

            {/* Technical */}
            <div className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
              <p className="font-medium text-white">{TOWER_ELEVATORS.technical.name}</p>
              <p className="text-xs text-zinc-500">成功率 30% · 失敗時 {TOWER_ELEVATORS.technical.failPenalty}</p>
              <p className="mt-1 text-gold">{s.costTechnical} チップ</p>
              <button
                type="button"
                onClick={() => handleRide('technical')}
                disabled={rideLoading || s.gems < s.costTechnical}
                className="mt-3 w-full rounded-lg border border-zinc-600 bg-zinc-800 py-2 text-sm font-medium text-zinc-300 disabled:opacity-50"
              >
                {rideLoading ? '処理中...' : '乗る'}
              </button>
            </div>
          </div>
        </section>

        {/* ショップ */}
        <section className="mt-6 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
          <button
            type="button"
            onClick={() => setShopOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left font-medium text-white"
          >
            タワーショップ（時価）
            <span className="text-zinc-500">{shopOpen ? '▲' : '▼'}</span>
          </button>
          {shopOpen && (
            <div className="mt-3 space-y-2">
              {(Object.keys(TOWER_ITEMS) as (keyof typeof TOWER_ITEMS)[]).map((id) => {
                const item = TOWER_ITEMS[id];
                return (
                  <div key={id} className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-xs text-zinc-500">{item.effect}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBuy(id)}
                      disabled={shopLoading !== null || s.gems < item.price}
                      className="shrink-0 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-3 py-1.5 text-sm text-gold disabled:opacity-50"
                    >
                      {shopLoading === id ? '購入中...' : `${item.price} チップ`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

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
