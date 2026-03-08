'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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

function TowerEventContent() {
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === '1' || searchParams.get('dev') === '1';
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
    const url = isPreview ? '/api/event/tower?preview=1' : '/api/event/tower';
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? '状態の取得に失敗しました');
      setState(null);
      return;
    }
    const data = await res.json();
    setState(data);
    setError(null);
  }, [isPreview]);

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
          ...(isPreview ? { preview: true } : {}),
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
        body: JSON.stringify({ itemId, ...(isPreview ? { preview: true } : {}) }),
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
        <AppHeader backHref={isPreview ? '/event?preview=1' : '/event'} />
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
        <AppHeader backHref={isPreview ? '/event?preview=1' : '/event'} />
        <main className="min-h-0 flex-1 overflow-y-auto content-below-header safe-area-pad px-4 sm:px-6">
          <div className="mx-auto max-w-2xl pt-4">
            <div className="rounded-2xl border border-red-800/50 bg-red-950/30 px-5 py-4">
              <p className="text-sm text-red-200">{error}</p>
              <Link href={isPreview ? '/event?preview=1' : '/event'} className="mt-3 inline-block text-sm font-medium text-gold hover:text-gold-bright">← イベント一覧へ</Link>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const s = state!;
  const tickerText = `【摩天楼のタワー】三択エレベーターで階層を登れ　VIP・リスク・テクニカル　タワーショップでアイテム購入　`;

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black tower-bg">
      <AppHeader backHref={isPreview ? '/event?preview=1' : '/event'} />

      <div className="event-ticker-wrap">
        <div className="event-ticker-track">
          <span>{tickerText.repeat(4)}</span>
        </div>
      </div>

      <main
        className="min-h-0 flex-1 overflow-y-auto content-below-header safe-area-pad"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex gap-0 px-3 sm:px-4 max-w-2xl mx-auto">
          {/* 左: 階スケール（sticky） */}
          <div className="tower-floor-scale shrink-0 hidden sm:block">
            <span className="tower-floor-scale-label">階</span>
            <span className="tower-floor-scale-value">{s.currentFloor}</span>
            <span className="text-xs text-zinc-500 mt-0.5">F</span>
          </div>

          <div className="flex-1 min-w-0 py-4">
            <header className="pb-3">
              <h1 className="event-title-wrap text-xl font-bold tracking-tight sm:text-2xl">
                <span className="event-title-gold">摩天楼のタワー</span>
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">三択のエレベーターで階層を登ろう</p>
            </header>

            {/* 状態バー（階・XP・チップ） */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="rounded-full bg-slate-800/80 border border-slate-600/60 px-3 py-1.5 text-xs font-semibold text-gold">
                {s.currentFloor} F
              </span>
              <span className="rounded-full bg-slate-800/80 border border-slate-600/60 px-3 py-1.5 text-xs text-slate-300">
                階層XP <span className="font-semibold text-white">{s.floorXp}</span>
              </span>
              <span className="rounded-full bg-slate-800/80 border border-slate-600/60 px-3 py-1.5 text-xs text-gold">
                チップ <span className="font-semibold">{s.gems}</span>
              </span>
              {s.goldenOilActive && <span className="rounded-full bg-amber-900/50 px-3 py-1 text-xs font-medium text-amber-200">黄金オイル</span>}
              {s.shockMatCount > 0 && <span className="rounded-full bg-slate-600 px-3 py-1 text-xs text-slate-200">衝撃吸収×{s.shockMatCount}</span>}
              {s.masterKeyFloorsLeft > 0 && <span className="rounded-full bg-purple-900/50 px-3 py-1 text-xs font-medium text-purple-200">マスターキー{s.masterKeyFloorsLeft}</span>}
            </div>

            <div className="rounded-xl border border-slate-600/50 bg-slate-900/60 px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-slate-200">塔の気候: {s.climate.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">{s.climate.effect}</p>
              <p className="mt-1 text-xs text-slate-500">次回: {new Date(s.climateNextChangeMs).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</p>
              {s.ghostXpAtFloor > 0 && (
                <p className="mt-2 text-xs text-amber-300">👻 遺失XP {s.ghostXpAtFloor}（上昇で回収）</p>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* 乗車結果（上昇/落下フィードバック） */}
            {lastResult && (
              <div
                className={`mb-4 rounded-xl border px-4 py-3 ${
                  lastResult.success ? 'border-emerald-700/50 bg-emerald-900/30 text-emerald-200 tower-rise-feedback' : 'border-amber-700/50 bg-amber-900/30 text-amber-200 tower-fall-feedback'
                }`}
              >
                <p className="font-medium">{lastResult.message}</p>
                {lastResult.ghostCollected != null && lastResult.ghostCollected > 0 && (
                  <p className="mt-1 text-sm opacity-90">遺失XP +{lastResult.ghostCollected} 回収</p>
                )}
              </div>
            )}

            {/* 三択エレベーター（縦に並ぶ＝登る選択） */}
            <h2 className="text-sm font-semibold text-slate-300 mb-3">エレベーターを選択 — 階を登れ</h2>
            <div className="space-y-4">
              {/* VIP */}
              <div className={`tower-elevator-card tower-elevator-vip`}>
                <p className="font-semibold text-white">{TOWER_ELEVATORS.vip.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{TOWER_ELEVATORS.vip.failPenalty}</p>
                <p className="mt-2 text-gold font-semibold">{s.costVipClimate} チップ</p>
                {s.masterKeyFloorsLeft > 0 && (
                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={useMasterKey} onChange={(e) => setUseMasterKey(e.target.checked)} className="rounded" />
                    マスターキー（30%オフ → {Math.floor(s.costVipClimate * 0.7)}）
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => handleRide('vip')}
                  disabled={rideLoading || s.gems < (useMasterKey && s.masterKeyFloorsLeft > 0 ? Math.floor(s.costVipClimate * 0.7) : s.costVipClimate)}
                  className="event-btn-primary-sm mt-3 w-full text-black"
                >
                  {rideLoading ? '処理中...' : '乗る'}
                </button>
              </div>

              {/* Risk */}
              <div className="tower-elevator-card tower-elevator-risk">
                <p className="font-semibold text-white">{TOWER_ELEVATORS.risk.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">成功率 {s.riskSuccessPct}% · 失敗時 {TOWER_ELEVATORS.risk.failPenalty}</p>
                <p className="mt-2 text-amber-400 font-semibold">{s.costRisk} チップ</p>
                {s.goldenOilActive && (
                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={useGoldenOil} onChange={(e) => setUseGoldenOil(e.target.checked)} className="rounded" />
                    黄金のオイル（+20%）
                  </label>
                )}
                {s.shockMatCount > 0 && (
                  <label className="mt-1 flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={useShockMat} onChange={(e) => setUseShockMat(e.target.checked)} className="rounded" />
                    衝撃吸収マット
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => handleRide('risk')}
                  disabled={rideLoading || s.gems < s.costRisk}
                  className="event-btn-primary-sm mt-3 w-full text-black"
                >
                  {rideLoading ? '処理中...' : '乗る'}
                </button>
              </div>

              {/* Technical */}
              <div className="tower-elevator-card tower-elevator-technical">
                <p className="font-semibold text-white">{TOWER_ELEVATORS.technical.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">成功率 30% · 失敗時 {TOWER_ELEVATORS.technical.failPenalty}</p>
                <p className="mt-2 text-slate-300 font-semibold">{s.costTechnical} チップ</p>
                <button
                  type="button"
                  onClick={() => handleRide('technical')}
                  disabled={rideLoading || s.gems < s.costTechnical}
                  className="event-btn-primary-sm mt-3 w-full text-black"
                >
                  {rideLoading ? '処理中...' : '乗る'}
                </button>
              </div>
            </div>

            {/* ショップ */}
            <section className="event-section mt-6 p-4">
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
              <Link href={isPreview ? '/event?preview=1' : '/event'} className="text-sm text-gold hover:text-gold-bright">
                ← イベント一覧へ
              </Link>
            </p>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

export default function TowerEventPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <AppHeader backHref="/event" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)]/70 border-t-transparent" />
          <LoadingWithPercent className="text-zinc-400" />
        </div>
        <BottomNav />
      </div>
    }>
      <TowerEventContent />
    </Suspense>
  );
}
