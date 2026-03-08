'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { GACHA_ITEMS } from '@/lib/gacha-items';
import {
  EQUIPMENT_GRADES,
  EQUIPMENT_GRADE_LABELS,
  GACHA_EQUIPMENT,
  nextEquipmentGrade,
  costForEquipmentLevel,
  costForEquipmentEvolve,
  equipmentEffectMultiplier,
  timeDecayRateMultiplier,
  formatEffectDescription,
  type EquipmentGrade,
} from '@/lib/equipment-items';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';
import { costForNextLevel, SEASON_BRANCHES, type EvolutionBranch } from '@/lib/evolution';

type EvolutionState = {
  points: number;
  branches: { correct_time: number; score: number; wrong_penalty: number };
  seasonCarry?: { correct_time: number; score: number; wrong_penalty: number };
  currentSeason?: string;
  seasonEnd?: string;
};

const SEASON_BOOSTS: {
  id: EvolutionBranch;
  icon: string;
  label: string;
  effectThisSeason: string;
  effectCarry: string;
  formatValue: (level: number, carry: number) => string;
}[] = [
  { id: 'correct_time', icon: '📖', label: '研鑽の極意', effectThisSeason: '獲得XPアップ +1.0% (最大10%)', effectCarry: '基礎XP倍率 +1.0% (1.01倍)', formatValue: (level, carry) => `+${level}%${carry ? ' / 翌シーズン 1.01倍' : ''}` },
  { id: 'score', icon: '👑', label: '至高の技巧', effectThisSeason: '基礎スコアアップ +1.0% (最大10%)', effectCarry: '基礎スコア倍率 +1.0% (1.01倍)', formatValue: (level, carry) => `+${level}%${carry ? ' / 翌シーズン 1.01倍' : ''}` },
  { id: 'wrong_penalty', icon: '🔥', label: '魂の燃焼', effectThisSeason: 'スタミナ回復速度 +1% (最大10%早い)', effectCarry: 'スタミナ回復速度 +1% (1.01倍)', formatValue: (level, carry) => `+${level}%${carry ? ' / 翌シーズン 1.01倍' : ''}` },
];

function useSeasonCountdown(seasonEndIso: string | undefined) {
  const [rem, setRem] = useState({ days: 0, hours: 0, minutes: 0 });
  useEffect(() => {
    if (!seasonEndIso) return;
    const tick = () => {
      const end = new Date(seasonEndIso).getTime();
      const diff = Math.max(0, end - Date.now());
      setRem({ days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), minutes: Math.floor((diff % 3600000) / 60000) });
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [seasonEndIso]);
  return rem;
}

const GACHA_IMAGE_BASE = '/gacha';
/** 装備の本: 最大20種類（4部位×5種類）。同一装備は1種類1エントリにまとめる */
const MAX_EQUIPMENT_BOOK_KINDS = 20;

/** アイテムの本に表示するイベント獲得アイテム（1番くじ等） */
const EVENT_BOOK_ITEM_IDS = ['eternal_cross_fragment', 'xp_booster'] as const;

const SLOT_ORDER = ['weapon', 'head', 'torso', 'feet'] as const;
const SLOT_LABELS: Record<string, string> = { weapon: '武器', head: '頭', torso: '胴体', feet: '足' };

/** 同じ equipment_id のスタックを取得。装着優先→強さ順（グレード→レベル） */
function getSameEquipmentStacks(
  equipment: EquipmentStack[],
  equipmentId: string,
  slot: string,
  equipped: Record<string, EquippedSlot>
): EquipmentStack[] {
  const list = equipment.filter((e) => e.equipment_id === equipmentId);
  const slotEquipped = equipped[slot];
  const gradeOrder = (g: string) => {
    const i = EQUIPMENT_GRADES.indexOf(g as EquipmentGrade);
    return i < 0 ? -1 : i;
  };
  return [...list].sort((a, b) => {
    const aEquipped = slotEquipped?.equipment_id === a.equipment_id && slotEquipped?.grade === a.grade && slotEquipped?.level === a.level ? 1 : 0;
    const bEquipped = slotEquipped?.equipment_id === b.equipment_id && slotEquipped?.grade === b.grade && slotEquipped?.level === b.level ? 1 : 0;
    if (bEquipped !== aEquipped) return bEquipped - aEquipped;
    if (gradeOrder(b.grade) !== gradeOrder(a.grade)) return gradeOrder(b.grade) - gradeOrder(a.grade);
    return (b.level ?? 0) - (a.level ?? 0);
  });
}

/** 装備一覧を「種類ごと1エントリ」にまとめ、最大20種類。各エントリはその種類の代表スタック（最強の1つ） */
function getEquipmentListForBook(
  equipment: EquipmentStack[],
  equipped: Record<string, EquippedSlot>
): EquipmentStack[] {
  const slotIdx = (s: string) => SLOT_ORDER.indexOf(s as (typeof SLOT_ORDER)[number]) ?? 4;
  const gradeOrder = (g: string) => {
    const i = EQUIPMENT_GRADES.indexOf(g as EquipmentGrade);
    return i < 0 ? -1 : i;
  };
  const byId = new Map<string, EquipmentStack[]>();
  for (const e of equipment) {
    const list = byId.get(e.equipment_id) ?? [];
    list.push(e);
    byId.set(e.equipment_id, list);
  }
  const uniqueIds = Array.from(byId.keys()).sort((a, b) => {
    const stacksA = byId.get(a)!;
    const stacksB = byId.get(b)!;
    const slotA = slotIdx(stacksA[0]!.slot);
    const slotB = slotIdx(stacksB[0]!.slot);
    if (slotA !== slotB) return slotA - slotB;
    return a.localeCompare(b);
  });
  const result: EquipmentStack[] = [];
  for (const id of uniqueIds.slice(0, MAX_EQUIPMENT_BOOK_KINDS)) {
    const stacks = getSameEquipmentStacks(equipment, id, byId.get(id)![0]!.slot, equipped);
    if (stacks[0]) result.push(stacks[0]);
  }
  return result;
}

function rarityColorClass(rarity: string): string {
  switch (rarity) {
    case 'SR':
    case 'レジェンダリー':
      return 'text-gold-bright';
    case 'R':
    case 'エピック':
      return 'text-purple-400';
    case 'レア':
      return 'text-gold';
    case 'N':
    case 'ノーマル':
    case 'コモン':
      return 'text-zinc-300';
    default:
      return 'text-zinc-500';
  }
}

function gradeColorClass(grade: string): string {
  switch (grade) {
    case 'eternal':
      return 'text-gold-bright';
    case 'legendary':
      return 'text-gold';
    case 'epic':
      return 'text-purple-400';
    case 'rare':
      return 'text-gold';
    case 'normal':
      return 'text-zinc-300';
    default:
      return 'text-zinc-400';
  }
}

type InventoryItem = { id: string; name: string; rarity: string; quantity: number; effect: string };
type EquipmentStack = {
  id: string;
  equipment_id: string;
  name: string;
  slot: string;
  slotLabel: string;
  trait: string;
  rarity: string;
  quantity: number;
  grade: string;
  level: number;
  effect_base?: number;
  effect: string;
};
type EquippedSlot = {
  equipment_id: string;
  grade: string;
  level: number;
  effect_base?: number;
  name: string;
  slotLabel: string;
  effect: string;
} | null;

export default function InventoryPage() {
  const [mainTab, setMainTab] = useState<'inventory' | 'evolution'>('inventory');
  /** 装備の本 | アイテムの本 */
  const [bookTab, setBookTab] = useState<'equipment' | 'eventItems'>('equipment');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [equipment, setEquipment] = useState<EquipmentStack[]>([]);
  const [equipped, setEquipped] = useState<Record<string, EquippedSlot>>({});
  const [evolutionPoints, setEvolutionPoints] = useState<number>(0);
  const [evolution, setEvolution] = useState<EvolutionState | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionMsg, setEvolutionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loadingBranch, setLoadingBranch] = useState<EvolutionBranch | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [equipSlotModal, setEquipSlotModal] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedStackOverride, setSelectedStackOverride] = useState<EquipmentStack | null>(null);
  const [sameEquipmentExpanded, setSameEquipmentExpanded] = useState(false);
  /** 出品モーダル用。1スタックずつ出品 */
  const [listConfirm, setListConfirm] = useState<{ equipment_id: string; grade: string; level: number; effect_base: number; name: string } | null>(null);
  const [listPrice, setListPrice] = useState('');
  /** 進化に使う5個を選ぶモーダル。stacks は同 equipment_id+grade のスタック一覧 */
  const [evolveSelectModal, setEvolveSelectModal] = useState<{
    equipment_id: string;
    grade: string;
    name: string;
    nextGrade: string;
    stacks: { level: number; effect_base: number; quantity: number }[];
  } | null>(null);
  /** 進化モーダル内で各スタックから使う個数。key = "level:effect_base" */
  const [evolveSelectChosen, setEvolveSelectChosen] = useState<Record<string, number>>({});
  const seasonRem = useSeasonCountdown(evolution?.seasonEnd);

  const equipmentListForBook = useMemo(
    () => getEquipmentListForBook(equipment, equipped),
    [equipment, equipped]
  );

  /** アイテムの本用：イベント獲得アイテムのみ（所持数0も表示して登録させる） */
  const eventBookItems = useMemo(() => {
    const list: InventoryItem[] = [];
    for (const id of EVENT_BOOK_ITEM_IDS) {
      const def = GACHA_ITEMS.find((g) => g.id === id);
      const held = items.find((i) => i.id === id);
      list.push({
        id,
        name: def?.name ?? id,
        rarity: def?.rarity ?? 'N',
        quantity: held?.quantity ?? 0,
        effect: def?.effect ?? '',
      });
    }
    return list;
  }, [items]);

  const fetchData = useCallback(async () => {
    const [invRes, equipRes, evoRes] = await Promise.all([
      fetch('/api/inventory', { credentials: 'include' }),
      fetch('/api/equipment', { credentials: 'include' }),
      fetch('/api/evolution', { credentials: 'include' }),
    ]);
    const invJson = invRes.ok ? await invRes.json() : null;
    const equipJson = equipRes.ok ? await equipRes.json() : null;
    const evoJson = evoRes.ok ? await evoRes.json() : null;

    const raw = invJson?.items ?? [];
    const enriched: InventoryItem[] = raw.map((it: { id: string; name: string; rarity: string; quantity: number }) => {
      const def = GACHA_ITEMS.find((g) => g.id === it.id);
      return {
        id: it.id,
        name: it.name,
        rarity: it.rarity,
        quantity: it.quantity,
        effect: def?.effect ?? '',
      };
    });
    setItems(enriched);
    setEquipment(equipJson?.items ?? []);
    setEquipped(equipJson?.equipped ?? {});
    const evo = evoJson && typeof (evoJson as EvolutionState).points === 'number' ? (evoJson as EvolutionState) : null;
    setEvolutionPoints(evo?.points ?? 0);
    setEvolution(evo);
    setLoading(false);
  }, []);

  const fetchEvolution = useCallback(() => {
    setEvolutionLoading(true);
    fetch('/api/evolution', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setEvolution(data && typeof (data as EvolutionState).points === 'number' ? data : null);
      })
      .catch(() => setEvolution(null))
      .finally(() => setEvolutionLoading(false));
  }, []);

  const handleUpgrade = useCallback(
    async (branch: EvolutionBranch) => {
      if (!evolution) return;
      const level = evolution.branches[branch];
      const isSeasonBranch = (SEASON_BRANCHES as readonly string[]).includes(branch);
      const cost = costForNextLevel(level, branch);
      const maxLevel = isSeasonBranch ? 10 : 9;
      if (level >= maxLevel || evolution.points < cost) return;
      setEvolutionMsg(null);
      setLoadingBranch(branch);
      try {
        const res = await fetch('/api/evolution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'upgrade', branch }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          setEvolution((e) =>
            e ? { ...e, points: j.points ?? e.points - cost, branches: { ...e.branches, [branch]: j.level ?? level + 1 } } : e
          );
          setEvolutionMsg({ type: 'ok', text: '進化しました' });
        } else {
          setEvolutionMsg({ type: 'err', text: (j as { error?: string }).error ?? '失敗しました' });
        }
      } catch {
        setEvolutionMsg({ type: 'err', text: 'エラー' });
      } finally {
        setLoadingBranch(null);
      }
    },
    [evolution]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [msg]);

  useEffect(() => {
    if (evolutionMsg) {
      const t = setTimeout(() => setEvolutionMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [evolutionMsg]);

  useEffect(() => {
    if (mainTab === 'evolution' && evolution == null && !evolutionLoading) fetchEvolution();
  }, [mainTab, evolution, evolutionLoading, fetchEvolution]);

  const currentList = bookTab === 'eventItems' ? eventBookItems : equipmentListForBook;
  useEffect(() => {
    setPageIndex((i) => Math.min(i, Math.max(0, currentList.length - 1)));
  }, [bookTab, currentList.length]);

  useEffect(() => {
    setSelectedStackOverride(null);
    setSameEquipmentExpanded(false);
  }, [bookTab]);

  const currentItem = currentList[pageIndex];

  const sameStacks = useMemo(() => {
    if (bookTab !== 'equipment' || !currentItem) return [];
    const eq = currentItem as EquipmentStack;
    return getSameEquipmentStacks(equipment, eq.equipment_id, eq.slot, equipped);
  }, [bookTab, currentItem, equipment, equipped]);

  /** 同じ装備・同じレアリティの合計個数（進化はレベル混在で5個必要） */
  const totalByEquipGrade = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of equipment) {
      const eq = e as EquipmentStack;
      const k = `${eq.equipment_id}:${eq.grade}`;
      map.set(k, (map.get(k) ?? 0) + (eq.quantity ?? 1));
    }
    return map;
  }, [equipment]);

  const displayedEquipment = useMemo(() => {
    if (bookTab !== 'equipment' || !currentItem) return null;
    if (selectedStackOverride) return selectedStackOverride;
    return sameStacks[0] ?? (currentItem as EquipmentStack);
  }, [bookTab, currentItem, selectedStackOverride, sameStacks]);

  const goPrev = () => {
    setSelectedStackOverride(null);
    setSameEquipmentExpanded(false);
    setPageIndex((i) => Math.max(0, i - 1));
  };
  const goNext = () => {
    setSelectedStackOverride(null);
    setSameEquipmentExpanded(false);
    setPageIndex((i) => Math.min(currentList.length - 1, i + 1));
  };

  const handleEquip = async (slot: string, equipment_id: string, grade: string, level: number, effect_base: number = 1) => {
    setActionLoading('equip');
    try {
      const res = await fetch('/api/equipment/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, equipment_id, grade, level, effect_base }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data?.error ?? '装着に失敗しました' });
        return;
      }
      setMsg({ type: 'ok', text: '装備しました' });
      setEquipSlotModal(null);
      fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleEvolve = async (equipment_id: string, grade: string, consume?: { level: number; effect_base: number; quantity: number }[]) => {
    setActionLoading(`evolve-${equipment_id}-${grade}`);
    try {
      const body: { equipment_id: string; grade: string; consume?: { level: number; effect_base: number; quantity: number }[] } = { equipment_id, grade };
      if (consume && consume.length > 0) body.consume = consume;
      const res = await fetch('/api/equipment/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data?.error ?? '進化に失敗しました' });
        return;
      }
      setMsg({ type: 'ok', text: `進化しました（${EQUIPMENT_GRADE_LABELS[data.newGrade as EquipmentGrade] ?? data.newGrade}）` });
      setEvolveSelectModal(null);
      setEvolveSelectChosen({});
      fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleLevelUp = async (equipment_id: string, grade: string, level: number) => {
    setActionLoading(`level-${equipment_id}-${grade}-${level}`);
    try {
      const res = await fetch('/api/equipment/level-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment_id, grade, level }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data?.error ?? 'レベルアップに失敗しました' });
        return;
      }
      setMsg({ type: 'ok', text: `Lv.${data.newLevel}になりました（${data.xpSpent} XP消費）` });
      fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleList = async () => {
    if (!listConfirm) return;
    const priceGems = Math.floor(Number(listPrice));
    if (!priceGems || priceGems < 1) {
      setMsg({ type: 'err', text: '価格は1チップ以上を入力してください' });
      return;
    }
    setActionLoading(`list-${listConfirm.equipment_id}`);
    try {
      const res = await fetch('/api/exchange/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          itemId: listConfirm.equipment_id,
          priceGems,
          equipment_grade: listConfirm.grade,
          equipment_level: listConfirm.level,
          effect_base: listConfirm.effect_base,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data?.error ?? '出品に失敗しました' });
        return;
      }
      setMsg({ type: 'ok', text: '出品しました。取引ページの購入タブに表示されます。' });
      setListConfirm(null);
      setListPrice('');
      fetchData();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gems-updated'));
    } finally {
      setActionLoading(null);
    }
  };

  const equipmentForSlot = (slot: string) => equipment.filter((e) => e.slot === slot);

  const handleUseItem = async (itemId: string) => {
    setActionLoading(`use-${itemId}`);
    try {
      const res = await fetch('/api/inventory/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data?.error ?? '使用に失敗しました' });
        return;
      }
      setMsg({ type: 'ok', text: '使用しました' });
      fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>
        <h1 className="text-xl font-bold text-white">装備</h1>

        {/* 持物 | 進化 */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMainTab('inventory')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mainTab === 'inventory' ? 'border-gold-subtle bg-[var(--gold)]/20 text-gold' : 'border-gold-subtle bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            持物
          </button>
          <button
            type="button"
            onClick={() => setMainTab('evolution')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mainTab === 'evolution' ? 'border-gold-subtle bg-[var(--gold)]/20 text-gold' : 'border-gold-subtle bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            進化
          </button>
        </div>

        {mainTab === 'evolution' ? (
          /* 進化タブ: XP・シーズン強化 */
          <div className="mt-6 space-y-4">
            <p className="text-sm text-zinc-500">全国モードで獲得したXPでシーズン強化ができます。</p>
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3">
              {evolutionLoading && evolution == null ? (
                <LoadingWithPercent className="block text-sm text-zinc-500" />
              ) : evolution == null ? (
                <div>
                  <p className="text-sm text-zinc-400">所持XPを取得できませんでした</p>
                  <button type="button" onClick={() => fetchEvolution()} className="mt-2 text-sm text-amber-500 hover:text-amber-400">再読み込み</button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-zinc-400">所持XP <span className="font-bold text-amber-400">{(evolution.points ?? 0).toLocaleString()}</span></p>
                  <p className="mt-1 text-xs text-zinc-500">累積ボーナス倍率: +{(1 + 0.01 * (evolution.branches?.correct_time ?? 0) + 0.01 * (evolution.branches?.score ?? 0) + 0.01 * (evolution.branches?.wrong_penalty ?? 0)).toFixed(2)}x</p>
                </>
              )}
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3">
                <p className="text-xs text-zinc-500">{evolution?.currentSeason ? `${evolution.currentSeason.replace(/-(\d+)$/, (_, m) => `年${parseInt(m, 10)}月`)}シーズン` : '今月のシーズン'}</p>
                <p className="mt-1 text-sm text-zinc-400">シーズン終了まで <span className="font-bold text-white">{seasonRem.days}日 {seasonRem.hours}時間 {seasonRem.minutes}分</span></p>
              </div>
              <p className="text-xs text-zinc-500">各Lv.10達成で翌シーズンに特典が継承されます。</p>
              <div className="space-y-3">
                {SEASON_BOOSTS.map((boost) => {
                  const level = evolution?.branches[boost.id] ?? 0;
                  const carryKey = boost.id as 'correct_time' | 'score' | 'wrong_penalty';
                  const carry = evolution?.seasonCarry?.[carryKey] ?? 0;
                  const cost = costForNextLevel(level, boost.id);
                  const xp = evolution?.points ?? 0;
                  const canUp = level < 10 && xp >= cost;
                  const isMax = level >= 10;
                  const valueText = boost.formatValue(level, carry);
                  return (
                    <div key={boost.id} className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-xl" aria-hidden>{boost.icon}</span>
                          <p className="mt-1 font-medium text-white">{boost.label} (Lv.{level}){carry > 0 && <span className="ml-1.5 text-xs font-bold text-amber-400">翌シーズン特典付与</span>}</p>
                          <p className="mt-1 text-xs text-zinc-400">今シーズン: {boost.effectThisSeason} → {valueText}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">Lv.10達成時: {boost.effectCarry}</p>
                        </div>
                        <div className="shrink-0">
                          {isMax ? (
                            <span className="rounded-lg border border-amber-500/50 bg-amber-900/30 px-3 py-1.5 text-xs font-bold text-amber-300">MAX</span>
                          ) : (
                            <button type="button" onClick={() => handleUpgrade(boost.id)} disabled={!canUp || loadingBranch !== null} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">
                              {loadingBranch === boost.id ? '…' : `${cost.toLocaleString()} XP`}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {evolutionMsg && (
              <div className={`fixed bottom-24 left-4 right-4 z-50 rounded-lg px-4 py-3 text-center text-sm sm:left-1/2 sm:right-auto sm:w-80 sm:-translate-x-1/2 ${evolutionMsg.type === 'ok' ? 'bg-zinc-800 border border-emerald-600/50 text-emerald-200' : 'bg-zinc-800 border border-red-600/50 text-red-200'}`}>
                {evolutionMsg.text}
              </div>
            )}
          </div>
        ) : (
          <>
        <p className="mt-2 text-sm text-zinc-500">ガチャで獲得した装備を図鑑形式で表示します。</p>

        {/* 装備スロット（図鑑の上） */}
        <div className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
          <h2 className="text-sm font-medium text-zinc-400">装備スロット</h2>
          <p className="mt-0.5 text-xs text-zinc-500">スロットをタップして装備を選択できます。</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['weapon', 'head', 'torso', 'feet'] as const).map((slot) => {
              const eq = equipped[slot];
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setEquipSlotModal(slot)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-gold-subtle bg-zinc-800/80 py-3 text-left hover:bg-zinc-700"
                >
                  <span className="text-xs text-zinc-500">{SLOT_LABELS[slot] ?? slot}</span>
                  {eq ? (
                    <>
                      <span className="line-clamp-2 text-center text-sm font-medium text-white">{eq.name}</span>
                      <span className={`text-xs ${gradeColorClass(eq.grade)}`}>
                        {EQUIPMENT_GRADE_LABELS[eq.grade as EquipmentGrade] ?? eq.grade} Lv.{eq.level}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-zinc-500">未装備</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 出品モーダル（価格入力） */}
        {listConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !actionLoading && (setListConfirm(null), setListPrice(''))}>
            <div className="w-full max-w-sm rounded-xl border border-gold-subtle bg-zinc-900 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-zinc-300">「{listConfirm.name}」を出品</p>
              <p className="mt-1 text-xs text-zinc-500">1個のみ出品できます。価格（チップ）を入力してください。</p>
              <input
                type="number"
                min={1}
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="例: 100"
                className="mt-4 w-full rounded-lg border border-gold-subtle bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500"
              />
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleList}
                  disabled={actionLoading !== null || !listPrice || Math.floor(Number(listPrice)) < 1}
                  className="flex-1 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 py-2 text-sm font-medium text-gold disabled:opacity-50"
                >
                  {actionLoading !== null ? '出品中…' : '出品する'}
                </button>
                <button
                  type="button"
                  onClick={() => { setListConfirm(null); setListPrice(''); }}
                  disabled={actionLoading !== null}
                  className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
        {evolveSelectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !actionLoading && (setEvolveSelectModal(null), setEvolveSelectChosen({}))}>
            <div className="w-full max-w-sm rounded-xl border border-purple-800/80 bg-zinc-900 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-medium text-white">進化に使う5個を選んでください</p>
              <p className="mt-0.5 text-xs text-zinc-500">{evolveSelectModal.name} → {EQUIPMENT_GRADE_LABELS[evolveSelectModal.nextGrade as EquipmentGrade] ?? evolveSelectModal.nextGrade}</p>
              {(() => {
                const xpCost = costForEquipmentEvolve(evolveSelectModal.grade as EquipmentGrade);
                return Number.isFinite(xpCost) && xpCost > 0 ? (
                  <p className="mt-1 text-xs text-amber-400/90">進化に全共通XP <strong>{xpCost.toLocaleString()}</strong> 必要（所持: {evolutionPoints.toLocaleString()}）</p>
                ) : null;
              })()}
              {evolveSelectModal.nextGrade === 'eternal' && (
                <p className="mt-1 text-xs text-gold">エターナル素材を1個消費します。</p>
              )}
              <ul className="mt-3 space-y-2">
                {evolveSelectModal.stacks.map((s) => {
                  const key = `${s.level}:${s.effect_base}`;
                  const chosen = evolveSelectChosen[key] ?? 0;
                  return (
                    <li key={key} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2">
                      <span className="text-xs text-zinc-300">Lv.{s.level}（所持{s.quantity}個）</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEvolveSelectChosen((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 0) - 1) }))}
                          disabled={chosen <= 0}
                          className="h-7 w-7 rounded border border-zinc-600 bg-zinc-700 text-zinc-300 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="min-w-[1.5rem] text-center text-sm text-white">{chosen}</span>
                        <button
                          type="button"
                          onClick={() => setEvolveSelectChosen((prev) => ({ ...prev, [key]: Math.min(s.quantity, (prev[key] ?? 0) + 1) }))}
                          disabled={chosen >= s.quantity}
                          className="h-7 w-7 rounded border border-zinc-600 bg-zinc-700 text-zinc-300 disabled:opacity-40"
                        >
                          ＋
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-zinc-500">合計5個選んでください（選んだ中で最も高いLvの倍率が進化後に引き継がれます）</p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const total = evolveSelectModal.stacks.reduce((sum, st) => sum + (evolveSelectChosen[`${st.level}:${st.effect_base}`] ?? 0), 0);
                    if (total !== 5) return;
                    const consume = evolveSelectModal.stacks
                      .map((st) => ({ level: st.level, effect_base: st.effect_base, quantity: evolveSelectChosen[`${st.level}:${st.effect_base}`] ?? 0 }))
                      .filter((c) => c.quantity > 0);
                    handleEvolve(evolveSelectModal.equipment_id, evolveSelectModal.grade, consume);
                  }}
                  disabled={
                    actionLoading !== null
                    || evolveSelectModal.stacks.reduce((sum, st) => sum + (evolveSelectChosen[`${st.level}:${st.effect_base}`] ?? 0), 0) !== 5
                    || (() => { const c = costForEquipmentEvolve(evolveSelectModal.grade as EquipmentGrade); return Number.isFinite(c) && c > 0 && evolutionPoints < c; })()
                  }
                  className="flex-1 rounded-lg border border-purple-700 bg-purple-900/50 py-2 text-sm font-medium text-purple-200 hover:bg-purple-800/50 disabled:opacity-50"
                >
                  {actionLoading !== null ? '処理中...' : '進化する'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEvolveSelectModal(null); setEvolveSelectChosen({}); }}
                  disabled={actionLoading !== null}
                  className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
        {equipSlotModal && (
          <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setEquipSlotModal(null)}>
            <div className="w-full max-h-[70vh] overflow-y-auto rounded-t-xl border border-gold-subtle bg-zinc-900 p-4 sm:max-w-md sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-medium text-zinc-400">{SLOT_LABELS[equipSlotModal] ?? equipSlotModal}を選択</h3>
              <ul className="mt-3 space-y-2">
                {equipmentForSlot(equipSlotModal).map((e) => (
                  <li key={`${e.equipment_id}-${e.grade}-${e.level}-${e.effect_base ?? 1}`}>
                    <button
                      type="button"
                      onClick={() => handleEquip(equipSlotModal, e.equipment_id, e.grade, e.level, e.effect_base ?? 1)}
                      disabled={actionLoading === 'equip'}
                      className="flex w-full items-center justify-between rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-left hover:bg-zinc-700 disabled:opacity-50"
                    >
                      <span className="text-sm text-white">{e.name}</span>
                      <span className={`text-xs ${gradeColorClass(e.grade)}`}>
                        {EQUIPMENT_GRADE_LABELS[e.grade as EquipmentGrade] ?? e.grade} Lv.{e.level} ×{e.quantity}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {equipmentForSlot(equipSlotModal).length === 0 && (
                <p className="text-sm text-zinc-500">このスロットの装備がありません。</p>
              )}
              <button type="button" onClick={() => setEquipSlotModal(null)} className="mt-3 w-full rounded-lg border border-gold-subtle py-2 text-sm text-zinc-400">
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* 装備の本 | アイテムの本 */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setBookTab('equipment'); setPageIndex(0); }}
            className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              bookTab === 'equipment'
                ? 'border-gold-subtle bg-[var(--gold)]/20 text-gold'
                : 'border-zinc-600 bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            装備の本
          </button>
          <button
            type="button"
            onClick={() => { setBookTab('eventItems'); setPageIndex(0); }}
            className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              bookTab === 'eventItems'
                ? 'border-gold-subtle bg-[var(--gold)]/20 text-gold'
                : 'border-zinc-600 bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            アイテムの本
          </button>
        </div>

        {loading ? (
          <LoadingWithPercent className="mt-6 block text-zinc-500" />
        ) : currentList.length === 0 ? (
          <div className="mt-6 rounded-xl border border-gold-subtle bg-zinc-900/80 p-6">
            <p className="text-center text-zinc-500">
              {bookTab === 'eventItems' ? 'アイテムの本に登録されているアイテムはありません。' : 'まだ装備がありません。'}
            </p>
          </div>
        ) : (
          <motion.div
            layout
            key={bookTab}
            className="relative mt-6 overflow-hidden rounded-xl shadow-2xl"
            style={{
              background: 'linear-gradient(180deg, #0a0a0a 0%, #171717 15%, #27272a 50%, #171717 85%, #0a0a0a 100%)',
              boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 0 40px var(--gold-muted)',
              border: '2px solid var(--gold-border)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 z-0 rounded-xl opacity-[0.03]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              }}
              aria-hidden
            />
            <div className="relative p-6">
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={pageIndex <= 0}
                  className="rounded-lg border border-gold-subtle bg-[var(--gold)]/10 px-3 py-2 text-sm font-medium text-gold-bright disabled:opacity-30"
                >
                  ← 前
                </button>
                <span className="text-xs text-zinc-500">
                  {pageIndex + 1} / {currentList.length}
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={pageIndex >= currentList.length - 1}
                  className="rounded-lg border border-gold-subtle bg-[var(--gold)]/10 px-3 py-2 text-sm font-medium text-gold-bright disabled:opacity-30"
                >
                  次 →
                </button>
              </div>

              <AnimatePresence mode="wait">
                {currentItem && (
                  <motion.div
                    key={bookTab === 'eventItems' ? (currentItem as InventoryItem).id : `${(displayedEquipment as EquipmentStack)?.equipment_id}-${(displayedEquipment as EquipmentStack)?.grade}-${(displayedEquipment as EquipmentStack)?.level}-${(displayedEquipment as EquipmentStack)?.effect_base ?? 1}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="min-h-[280px] rounded-lg border border-gold-subtle bg-[var(--gold)]/10 p-4"
                  >
                    {bookTab === 'eventItems' ? (
                      <>
                        <h2 className="border-b border-gold-subtle pb-2 font-serif text-lg font-bold text-white">
                          {currentItem.name}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`text-xs ${rarityColorClass((currentItem as InventoryItem).rarity)}`}>
                            {(currentItem as InventoryItem).rarity}
                          </span>
                          <span className="text-xs font-bold text-gold">所持数: {currentItem.quantity}</span>
                        </div>
                        <div className="mt-4 flex justify-center">
                          <div className="flex h-20 w-full max-w-xs items-center justify-center rounded-lg border border-gold-subtle bg-zinc-800/80 px-4">
                            <span className="font-medium text-white">{currentItem.name}</span>
                          </div>
                        </div>
                        <div className="mt-4 rounded border border-gold-subtle bg-zinc-900/80 p-3">
                          <p className="text-xs font-medium text-gold">効果</p>
                          <p className="mt-1 text-sm leading-relaxed text-white/95">{currentItem.effect}</p>
                        </div>
                        {(currentItem as InventoryItem).id === 'xp_booster' && (currentItem as InventoryItem).quantity > 0 && (
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => handleUseItem('xp_booster')}
                              disabled={actionLoading !== null}
                              className="w-full rounded-lg border border-gold-subtle bg-[var(--gold)]/20 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
                            >
                              使う（30分間 獲得XP2倍）
                            </button>
                          </div>
                        )}
                        {(currentItem as InventoryItem).id === 'eternal_cross_fragment' && (
                          <p className="mt-4 text-xs text-zinc-500">進化でエターナル素材に変換できます。進化画面でご利用ください。</p>
                        )}
                      </>
                    ) : (
                      (() => {
                        const eq = displayedEquipment ?? (currentItem as EquipmentStack);
                        const slot = eq.slot;
                        const xpCost = costForEquipmentLevel(eq.level);
                        const canLevelUp = evolutionPoints >= xpCost;
                        const nextGrade = nextEquipmentGrade(eq.grade as EquipmentGrade);
                        const totalSameGrade = totalByEquipGrade.get(`${eq.equipment_id}:${eq.grade}`) ?? 0;
                        const eternalMaterialCount = items.find((i) => i.id === 'eternal_material')?.quantity ?? 0;
                        const canEvolve = nextGrade && totalSameGrade >= 5 && (nextGrade !== 'eternal' || eternalMaterialCount >= 1);
                        return (
                          <>
                            <h2 className="border-b border-gold-subtle pb-2 font-serif text-lg font-bold text-white">
                              {eq.name}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className={`text-xs ${eq.rarity === 'SR' ? 'text-gold' : eq.rarity === 'R' ? 'text-purple-400' : 'text-zinc-400'}`}>
                                {eq.rarity}
                              </span>
                              <span className={`text-xs ${gradeColorClass(eq.grade)}`}>
                                {EQUIPMENT_GRADE_LABELS[eq.grade as EquipmentGrade] ?? eq.grade} Lv.{eq.level}
                              </span>
                              <span className="text-xs text-gold/90">
                                {eq.slotLabel} / {eq.trait}
                              </span>
                              <span className="text-xs font-bold text-gold">所持数: {eq.quantity}</span>
                            </div>
                            <div className="mt-4 rounded border border-gold-subtle bg-zinc-900/80 p-3">
                              <p className="text-xs font-medium text-gold">効果</p>
                              <p className="mt-1 text-sm leading-relaxed text-white/95">
                                {(() => {
                                  const def = GACHA_EQUIPMENT.find((x) => x.id === eq.equipment_id);
                                  const level = Math.max(0, Math.floor(Number(eq.level)) || 0);
                                  const effectBase = Math.max(0, Number(eq.effect_base) || 1);
                                  const grade = eq.grade as EquipmentGrade;
                                  const mult = def?.effectKey === 'time_decay_rate'
                                    ? timeDecayRateMultiplier(grade, level, effectBase)
                                    : equipmentEffectMultiplier(grade, level, effectBase);
                                  const value = (def?.effectInitialValue ?? 0) * mult;
                                  return formatEffectDescription(def?.effect ?? eq.effect, value);
                                })()}
                              </p>
                            </div>

                            <div className="mt-4 flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => handleEquip(slot, eq.equipment_id, eq.grade, eq.level, eq.effect_base ?? 1)}
                                disabled={actionLoading !== null}
                                className="w-full rounded-lg border border-gold-subtle bg-zinc-800 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                              >
                                この装備を装着
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLevelUp(eq.equipment_id, eq.grade, eq.level)}
                                disabled={!canLevelUp || actionLoading !== null}
                                className="w-full rounded-lg border border-gold-subtle bg-[var(--gold)]/20 py-2 text-sm text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
                              >
                                レベルアップ（{xpCost} XP） 所持XP: {evolutionPoints}
                              </button>
                              {nextGrade && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const stacks = (equipment as EquipmentStack[]).filter(
                                      (e) => e.equipment_id === eq.equipment_id && e.grade === eq.grade
                                    ).map((e) => ({ level: e.level ?? 0, effect_base: e.effect_base ?? 1, quantity: e.quantity ?? 1 }));
                                    setEvolveSelectModal({ equipment_id: eq.equipment_id, grade: eq.grade, name: eq.name, nextGrade, stacks });
                                    setEvolveSelectChosen({});
                                  }}
                                  disabled={!canEvolve || actionLoading !== null}
                                  className="w-full rounded-lg border border-purple-700/60 bg-purple-900/40 py-2 text-sm text-purple-200 hover:bg-purple-800/50 disabled:opacity-50"
                                >
                                  5個で進化 → {EQUIPMENT_GRADE_LABELS[nextGrade]}
                                  {(() => {
                                    const xpCost = costForEquipmentEvolve(eq.grade as EquipmentGrade);
                                    const xpText = Number.isFinite(xpCost) && xpCost > 0 ? `・進化に${xpCost.toLocaleString()} XP` : '';
                                    if (nextGrade === 'eternal') return `（エターナル素材1個必要・所持: ${eternalMaterialCount}${xpText}）`;
                                    return `（同レアリティ合計${totalSameGrade}個・使う5個を選べる${xpText}）`;
                                  })()}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setListConfirm({ equipment_id: eq.equipment_id, grade: eq.grade, level: eq.level ?? 0, effect_base: eq.effect_base ?? 1, name: eq.name })}
                                disabled={actionLoading !== null}
                                className="w-full rounded-lg border border-gold-subtle bg-[var(--gold)]/10 py-2 text-sm text-gold hover:bg-[var(--gold)]/20 disabled:opacity-50"
                              >
                                出品（取引で販売）
                              </button>

                              {/* 同じ装備をアコーディオンで一覧 */}
                              {sameStacks.length > 0 && (
                                <div className="mt-2 border-t border-gold-subtle/50 pt-3">
                                  <button
                                    type="button"
                                    onClick={() => setSameEquipmentExpanded((b) => !b)}
                                    className="flex w-full items-center justify-between rounded-lg border border-gold-subtle/60 bg-zinc-800/60 py-2 px-3 text-sm text-zinc-300 hover:bg-zinc-700/80"
                                  >
                                    <span>同じ装備を一覧（{sameStacks.length}個）</span>
                                    <span className="text-gold/80">{sameEquipmentExpanded ? '▲' : '▼'}</span>
                                  </button>
                                  <AnimatePresence>
                                    {sameEquipmentExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                                          {sameStacks.map((stack) => {
                                            const isSelected = displayedEquipment?.id === stack.id;
                                            return (
                                              <button
                                                key={stack.id}
                                                type="button"
                                                onClick={() => setSelectedStackOverride(stack)}
                                                className={`flex flex-col items-center gap-0.5 rounded-lg p-2 transition-colors ${
                                                  isSelected ? 'bg-[var(--gold)]/20 text-gold' : 'bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80'
                                                }`}
                                              >
                                                <span className="text-[10px] font-medium">Lv.{stack.level}</span>
                                                <span className="line-clamp-2 text-center text-xs">{stack.name}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* 使い切りアイテム */}
        <div className="mt-8 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
          <h2 className="text-sm font-medium text-zinc-400">使い切りアイテム</h2>
          <p className="mt-0.5 text-xs text-zinc-500">使用すると1個消費されます。</p>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">所持している使い切りアイテムはありません。</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-2 rounded-lg border border-gold-subtle bg-zinc-800/80 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{it.name}</p>
                    <p className="text-xs text-zinc-500">{it.effect}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-gold">×{it.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUseItem(it.id)}
                      disabled={actionLoading !== null || it.quantity < 1}
                      className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-3 py-1.5 text-xs font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
                    >
                      {actionLoading === `use-${it.id}` ? '使用中…' : '使う'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link href="/shop" className="mt-8 inline-block text-sm text-gold hover:text-gold-bright">
          ショップ・ガチャへ →
        </Link>
          </>
        )}
      </main>

      {msg && (
        <div
          className={`fixed bottom-24 left-4 right-4 z-10 mx-auto max-w-md rounded-lg px-4 py-2 text-center text-sm ${
            msg.type === 'ok' ? 'bg-emerald-900/90 text-emerald-200' : 'bg-red-900/90 text-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}
      <BottomNav />
    </div>
  );
}
