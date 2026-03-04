'use client';

import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';
import {
  GACHA_EQUIPMENT,
  EQUIPMENT_GRADE_LABELS,
  equipmentEffectMultiplier,
  timeDecayRateMultiplier,
  formatEffectDescription,
  type EquipmentGrade,
} from '@/lib/equipment-items';

const GACHA_IMAGE_BASE = '/gacha';
const EQUIPMENT_IMAGE_BASE = '/equipment';
const EQUIPMENT_GRADES: EquipmentGrade[] = ['common', 'normal', 'rare', 'epic', 'legendary', 'eternal'];

function rarityColorClass(rarity: string): string {
  if (['SR', 'レジェンダリー'].includes(rarity)) return 'text-gold-bright';
  if (['R', 'エピック'].includes(rarity)) return 'text-purple-400';
  if (['レア'].includes(rarity)) return 'text-gold';
  if (['ノーマル', 'N'].includes(rarity)) return 'text-zinc-300';
  if (['コモン'].includes(rarity)) return 'text-zinc-400';
  return 'text-zinc-500';
}

type ListingRow = {
  id: string;
  seller_id: string;
  item_type: string;
  item_id: string;
  quantity: number;
  price_gems: number;
  item_name: string;
  item_rarity: string;
  created_at: string;
  equipment_grade?: string | null;
  equipment_level?: number | null;
  effect_base?: number | null;
};

type ExchangeData = {
  gemsPerEx: number;
  userEx: number;
  userGuildXp?: number;
  userGems: number;
  listings: ListingRow[];
  myListings: (ListingRow & { seller_id?: string })[];
  myInventory: {
    items: { id: string; name: string; rarity: string; quantity: number }[];
    equipment: { id: string; name: string; rarity: string; quantity: number }[];
  };
  snapshotDate?: string;
  snapshotFound?: boolean;
};

export default function ExchangePage() {
  const [tab, setTab] = useState<'exchange' | 'buy'>('exchange');
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convertAmount, setConvertAmount] = useState('');
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [commonToGuildAmount, setCommonToGuildAmount] = useState('');
  const [commonToGuildLoading, setCommonToGuildLoading] = useState(false);
  const [commonToGuildError, setCommonToGuildError] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [buyLoading, setBuyLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (nameFilter) params.set('name', nameFilter);
    if (rarityFilter) params.set('rarity', rarityFilter);
    fetch(`/api/exchange?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setError(d ? null : 'データの取得に失敗しました');
      })
      .catch(() => setError('読み込みエラー'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [nameFilter, rarityFilter]);

  const handleConvert = async () => {
    const amount = Math.floor(Number(convertAmount));
    if (!amount || amount < 1) {
      setConvertError('1以上の整数を入力してください');
      return;
    }
    if (data && amount > data.userEx) {
      setConvertError('所持XPが足りません');
      return;
    }
    setConvertLoading(true);
    setConvertError(null);
    const res = await fetch('/api/exchange/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const json = await res.json().catch(() => ({}));
    setConvertLoading(false);
    if (!res.ok) {
      setConvertError(json.error ?? '交換に失敗しました');
      return;
    }
    setConvertAmount('');
    load();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gems-updated'));
  };

  const handleCommonToGuild = async () => {
    const amount = Math.floor(Number(commonToGuildAmount));
    if (!amount || amount < 1) {
      setCommonToGuildError('1以上の整数を入力してください');
      return;
    }
    if (data && amount > data.userEx) {
      setCommonToGuildError('全共通XPが足りません');
      return;
    }
    setCommonToGuildLoading(true);
    setCommonToGuildError(null);
    const res = await fetch('/api/exchange/common-to-guild-xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const json = await res.json().catch(() => ({}));
    setCommonToGuildLoading(false);
    if (!res.ok) {
      setCommonToGuildError(json.error ?? '交換に失敗しました');
      return;
    }
    setCommonToGuildAmount('');
    load();
  };

  const handleBuy = async (listingId: string) => {
    setBuyLoading(listingId);
    const res = await fetch('/api/exchange/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId }),
    });
    setBuyLoading(null);
    if (res.ok) {
      load();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gems-updated'));
    }
  };

  const handleCancel = async (listingId: string) => {
    setCancelLoading(listingId);
    await fetch(`/api/exchange/listings/${listingId}`, { method: 'DELETE' });
    setCancelLoading(null);
    load();
  };

  const rarityOptions = Array.from(
    new Set((data?.listings?.map((l) => l.item_rarity) ?? []))
  ).filter(Boolean).sort();

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader backHref="/" />
      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <h1 className="text-xl font-bold text-white">取引</h1>
        <p className="mt-2 text-sm text-zinc-500">
          XPをチップに交換したり、他プレイヤーの出品装備を購入できます。出品は装備ページから行います。
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('exchange')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'exchange' ? 'border-gold-subtle bg-[var(--gold)]/20 text-gold' : 'border-gold-subtle bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            XP→チップ
          </button>
          <button
            type="button"
            onClick={() => setTab('buy')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'buy' ? 'border-gold-subtle bg-[var(--gold)]/20 text-gold' : 'border-gold-subtle bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            購入
          </button>
        </div>

        {loading ? (
          <LoadingWithPercent className="mt-6 block text-zinc-500" />
        ) : error ? (
          <p className="mt-6 text-gold">{error}</p>
        ) : (
          <>
            {tab === 'exchange' && data && (
              <div className="mt-6 space-y-4">
                {/* 全共通XP → ジェム（ギルドXPはジェム交換に使用不可） */}
                <div className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
                  <p className="text-sm text-zinc-400">
                    1 全共通XP = <span className="font-bold text-gold">{data.gemsPerEx.toFixed(4)}</span> チップ
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    1 XP = 0.01 チップ（100 XP = 1 チップ）で固定です。
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    所持: 全共通XP <span className="font-bold">{data.userEx}</span> / ギルドXP <span className="font-bold">{data.userGuildXp ?? 0}</span> / チップ <span className="font-bold">{data.userGems}</span>
                  </p>
                  <p className="mt-1 text-xs text-amber-400/90">※ギルドXPはチップとの交換には使用できません。</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={data.userEx}
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    placeholder="交換する全共通XP数"
                    className="flex-1 rounded-lg border border-gold-subtle bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={handleConvert}
                    disabled={convertLoading || !convertAmount}
                    className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 text-gold px-4 py-2 font-medium disabled:opacity-50"
                  >
                    {convertLoading ? '処理中…' : '交換'}
                  </button>
                </div>
                {convertAmount && (() => {
                  const xp = Math.floor(Number(convertAmount)) || 0;
                  const gems = xp > 0 ? Math.floor(xp * data.gemsPerEx) : 0;
                  return (
                    <p className="mt-2 text-sm text-amber-200/90">
                      <span className="font-bold">{xp > 0 ? xp.toLocaleString() : '0'}</span> XP
                      → <span className="font-bold text-gold">{gems.toLocaleString()}</span> チップ
                      {xp > data.userEx && <span className="ml-2 text-red-400">（所持XP不足）</span>}
                    </p>
                  );
                })()}
                {convertError && <p className="text-sm text-red-400">{convertError}</p>}

                {/* 全共通XP → ギルドXP（1.2倍）。逆交換は不可 */}
                <div className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
                  <p className="text-sm text-zinc-400">
                    全共通XPをギルドXPに交換（1 全共通XP → <span className="font-bold text-gold">1.2</span> ギルドXP）。ギルドXPから全共通XPへの交換はできません。
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={data.userEx}
                      value={commonToGuildAmount}
                      onChange={(e) => setCommonToGuildAmount(e.target.value)}
                      placeholder="交換する全共通XP数"
                      className="flex-1 rounded-lg border border-gold-subtle bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={handleCommonToGuild}
                      disabled={commonToGuildLoading || !commonToGuildAmount}
                      className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 text-gold px-4 py-2 font-medium disabled:opacity-50"
                    >
                      {commonToGuildLoading ? '処理中…' : 'ギルドXPに交換'}
                    </button>
                  </div>
                  {commonToGuildAmount && (() => {
                    const xp = Math.floor(Number(commonToGuildAmount)) || 0;
                    const guildXp = xp > 0 ? Math.floor(xp * 1.2) : 0;
                    return (
                      <p className="mt-2 text-sm text-amber-200/90">
                        <span className="font-bold">{xp > 0 ? xp.toLocaleString() : '0'}</span> 全共通XP
                        → <span className="font-bold text-gold">{guildXp.toLocaleString()}</span> ギルドXP
                        {xp > data.userEx && <span className="ml-2 text-red-400">（所持XP不足）</span>}
                      </p>
                    );
                  })()}
                  {commonToGuildError && <p className="mt-1 text-sm text-red-400">{commonToGuildError}</p>}
                </div>
              </div>
            )}

            {tab === 'exchange' && data && data.myListings.length > 0 && (
              <div className="mt-6 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
                <h3 className="text-sm font-medium text-zinc-400">出品中の装備（装備ページから出品）</h3>
                <ul className="mt-2 space-y-2">
                  {data.myListings.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2"
                    >
                      <span className="text-sm text-white">
                        {l.item_name} - {l.price_gems}チップ
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCancel(l.id)}
                        disabled={cancelLoading === l.id}
                        className="text-xs text-red-400 hover:underline disabled:opacity-50"
                      >
                        {cancelLoading === l.id ? '取り消し中…' : '取り消し'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === 'buy' && data && (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    placeholder="名前で検索"
                    className="rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
                  />
                  <select
                    value={rarityFilter}
                    onChange={(e) => setRarityFilter(e.target.value)}
                    className="rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-sm text-white"
                  >
                    <option value="">レアリティ指定なし</option>
                    {rarityOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-zinc-500">支払いはチップのみ。購入額の90%が販売者へ、10%は焼却されます</p>
                {data.listings.filter((l) => l.item_type === 'equipment').length === 0 ? (
                  <p className="text-zinc-500">出品はありません</p>
                ) : (
                  <ul className="space-y-4">
                    {data.listings.filter((l) => l.item_type === 'equipment').map((l) => {
                      const def = GACHA_EQUIPMENT.find((e) => e.id === l.item_id);
                      const grade = (l.equipment_grade ?? 'common') as EquipmentGrade;
                      const level = typeof l.equipment_level === 'number' ? l.equipment_level : 0;
                      const effectBase = typeof l.effect_base === 'number' && l.effect_base >= 0 ? l.effect_base : 1;
                      const gradeLevelLine = EQUIPMENT_GRADES.map((g) => {
                        const label = EQUIPMENT_GRADE_LABELS[g] ?? g;
                        const lv = g === grade ? level : 0;
                        return `${label} Lv${lv}`;
                      }).join('　');
                      let effectText = '';
                      if (def?.effect && def.effectKey) {
                        const mult = def.effectKey === 'time_decay_rate'
                          ? timeDecayRateMultiplier(grade, level, effectBase)
                          : equipmentEffectMultiplier(grade, level, effectBase);
                        const value = (def.effectInitialValue ?? 0) * mult;
                        effectText = formatEffectDescription(def.effect, value);
                      }
                      return (
                        <li
                          key={l.id}
                          className="flex flex-col gap-2 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white">{l.item_name}</p>
                              <p className="mt-1 text-xs text-zinc-400">{gradeLevelLine}</p>
                              {effectText && (
                                <p className="mt-1.5 text-sm text-zinc-300">{effectText}</p>
                              )}
                              <p className="mt-2 text-sm font-bold text-gold">{l.price_gems} チップ</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleBuy(l.id)}
                              disabled={buyLoading === l.id || (data.userGems < l.price_gems)}
                              className="shrink-0 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-sm font-medium text-gold disabled:opacity-50"
                            >
                              {buyLoading === l.id ? '処理中…' : '購入'}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
