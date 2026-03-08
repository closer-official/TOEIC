'use client';

import { Suspense, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BottomNav } from '@/components/BottomNav';
import { AppHeader } from '@/components/AppHeader';
import { Roulette } from '@/components/Roulette';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';
import { EmbeddedCheckoutModal } from '@/components/EmbeddedCheckoutModal';
import Image from 'next/image';
import {
  useIsAppStore,
  useAppleIapProducts,
  purchaseAppleChip,
  purchaseAppleSubscription,
  restoreApplePurchases,
  openAppleSubscriptionManagement,
} from '@/lib/shop-apple-iap';

type SessionUser = { id: string; avatarUrl: string | null };
type GachaState = {
  freePullsLeft: number;
  nextFreeAt: number;
  isSubscriber: boolean;
  rateMultiplier: number;
  paidGachaPity?: number;
  items: { id: string; name: string; rarity: string; baseRate: number; currentRate: number }[];
  equipment?: { id: string; name: string; slotLabel: string; trait: string; rarity: string; baseRate: number; currentRate: number }[];
};

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

/** 会員ランク（Proで0.5天井・VIPで1天井。stamina_bonus/spin_bonus は無料分に加算） */
const PLANS = [
  { id: 'free', name: 'ゲスト', price: 0, chips: null as number | null, stamina: 50, recoveryPer24h: 80, spinsPerDay: 1 },
  { id: 'pro', name: 'Pro', price: 800, chips: 2500, stamina: 100, recoveryPer24h: 100, spinsPerDay: 2 },
  { id: 'ultra', name: 'VIP', price: 1500, chips: 5000, stamina: 200, recoveryPer24h: 200, spinsPerDay: 4 },
] as const;

type SubscriptionTier = 'free' | 'pro' | 'ultra';
const TIER_DISPLAY_NAME: Record<SubscriptionTier, string> = { free: 'ゲスト', pro: 'Pro', ultra: 'VIP' };

/** チップ購入パック（月1000円で1天井=5000チップを基準） */
const CHIP_PACKS = [
  { id: 'mini', chips: 200, label: '200', price: 50 },
  { id: 'small', chips: 2200, label: '2,200', price: 500 },
  { id: 'medium', chips: 5000, label: '5,000', price: 1000 },
  { id: 'large', chips: 16000, label: '16,000', price: 3000 },
  { id: 'xl', chips: 28000, label: '28,000', price: 5000 },
  { id: 'xxl', chips: 60000, label: '60,000', price: 10000 },
] as const;

const BRASS = '#C5A059';

/** 真上から見た1枚のカジノチップ（真円・マットブラック＋真鍮エッジ・デニミネーションストライプ＋Aエンボス） */
function CasinoChipSingle({ size = 28, className = '' }: { size?: number; className?: string }) {
  const id = useId();
  const r = (size / 2) - 1;
  const cx = size / 2;
  const cy = size / 2;
  const notchCount = 16;
  const notchOuter = r + 1;
  const notchInner = r - 0.8;
  const notches = Array.from({ length: notchCount }, (_, i) => {
    const angle = (i / notchCount) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    const x1 = cx + notchInner * Math.cos(rad);
    const y1 = cy + notchInner * Math.sin(rad);
    const x2 = cx + notchOuter * Math.cos(rad);
    const y2 = cy + notchOuter * Math.sin(rad);
    return { x1, y1, x2, y2 };
  });
  const uniqueId = `chip-${size}-${id.replace(/:/g, '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uniqueId}-face`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1816" />
          <stop offset="40%" stopColor="#0f0d0c" />
          <stop offset="100%" stopColor="#0a0807" />
        </linearGradient>
        <radialGradient id={`${uniqueId}-top`} cx="38%" cy="28%" r="55%">
          <stop offset="0%" stopColor="rgba(197,160,89,0.14)" />
          <stop offset="70%" stopColor="rgba(197,160,89,0.04)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id={`${uniqueId}-emboss`}>
          <feOffset in="SourceAlpha" dx="0.5" dy="0.5" result="offset" />
          <feGaussianBlur in="offset" stdDeviation="0.35" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* 真鍮エッジ（デニミネーション・ストライプの土台） */}
      <circle cx={cx} cy={cy} r={r + 1} fill={BRASS} opacity="0.92" />
      {/* マットブラックのクレイ本体 */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${uniqueId}-face)`} stroke={BRASS} strokeWidth="0.65" opacity="0.98" />
      {/* 暖色トップグロー（スポットライト風） */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${uniqueId}-top)`} />
      {/* エッジの切り欠き（真鍮インレイ） */}
      {notches.map((n, i) => (
        <line key={i} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={BRASS} strokeWidth="0.7" opacity="0.9" />
      ))}
      {/* 中央 A エンボス（深い型押し） */}
      <text
        x={cx}
        y={cy + (size * 0.08)}
        textAnchor="middle"
        fill={BRASS}
        fontSize={size * 0.34}
        fontWeight="bold"
        fontFamily="var(--font-playfair), Georgia, serif"
        filter={`url(#${uniqueId}-emboss)`}
        style={{ textShadow: '0 1.2px 0 rgba(0,0,0,0.7), 0 -0.6px 0 rgba(255,255,255,0.12)' }}
      >
        A
      </text>
    </svg>
  );
}

/** 1本の縦積みスタックを描画 */
function SingleStack({ count, chipSize, stackOffset }: { count: number; chipSize: number; stackOffset: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="absolute transition-transform duration-200 group-hover:translate-y-[-1px]"
          style={{
            bottom: i * stackOffset,
            left: '50%',
            transform: `translateX(-50%) translateY(${i * 0.5}px)`,
            zIndex: count - i,
          }}
        >
          <CasinoChipSingle size={chipSize} />
        </div>
      ))}
    </>
  );
}

/**
 * プラン別・真円カジノチップスタック（マットブラック＋真鍮・Aエンボス・エッジの切り欠き）。
 * 50/550: 1スタック（4枚/3枚）、1200/3900: 2スタック（5+3）、7000/15000: 手前の低い山＋奥の巨大スタック。
 */
function CasinoChipStack({ chips }: { chips: number }) {
  const stackOffset = 4;

  if (chips <= 50) {
    const chipSize = 22;
    return (
      <div
        className="casino-chip-stack relative flex items-end justify-center min-h-[3.5rem] w-full pb-1"
        aria-hidden
      >
        <div className="absolute inset-0 flex items-end justify-center" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55)) drop-shadow(0 2px 6px rgba(60,40,20,0.25))' }}>
          <div className="relative h-[3rem] w-8">
            <SingleStack count={4} chipSize={chipSize} stackOffset={stackOffset} />
          </div>
        </div>
      </div>
    );
  }
  if (chips <= 550) {
    const chipSize = 22;
    return (
      <div
        className="casino-chip-stack relative flex items-end justify-center min-h-[3.5rem] w-full pb-1"
        aria-hidden
      >
        <div className="absolute inset-0 flex items-end justify-center" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55)) drop-shadow(0 2px 6px rgba(60,40,20,0.25))' }}>
          <div className="relative h-[3rem] w-8">
            <SingleStack count={3} chipSize={chipSize} stackOffset={stackOffset} />
          </div>
        </div>
      </div>
    );
  }
  if (chips <= 3900) {
    const chipSize = chips <= 1200 ? 20 : 21;
    const gap = 6;
    return (
      <div
        className="casino-chip-stack relative flex items-end justify-center min-h-[3.5rem] w-full pb-1"
        aria-hidden
      >
        <div className="absolute inset-0 flex items-end justify-center gap-1" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55)) drop-shadow(0 2px 6px rgba(60,40,20,0.25))' }}>
          <div className="relative h-[3.2rem] w-7" style={{ marginRight: gap / 2 }}>
            <SingleStack count={5} chipSize={chipSize} stackOffset={stackOffset} />
          </div>
          <div className="relative h-[2.6rem] w-7" style={{ marginLeft: gap / 2 }}>
            <SingleStack count={3} chipSize={chipSize} stackOffset={stackOffset} />
          </div>
        </div>
      </div>
    );
  }
  const frontCount = chips >= 15000 ? 5 : 4;
  const backCount = chips >= 15000 ? 12 : 8;
  const chipSize = 18;
  return (
    <div
      className="casino-chip-stack relative flex items-end justify-center min-h-[4rem] w-full pb-1"
      aria-hidden
    >
      <div
        className="absolute inset-0 flex items-end justify-center"
        style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.6)) drop-shadow(0 3px 8px rgba(60,40,20,0.3))' }}
      >
        <div className="relative" style={{ width: 76, height: 72 }}>
          {/* 奥の巨大スタック */}
          <div className="absolute bottom-0" style={{ left: '50%', transform: 'translateX(-58%)', zIndex: 1 }}>
            <div className="relative" style={{ width: chipSize + 4, height: backCount * (stackOffset - 0.5) + chipSize }}>
              <SingleStack count={backCount} chipSize={chipSize} stackOffset={stackOffset - 0.5} />
            </div>
          </div>
          {/* 手前の低い山 */}
          <div className="absolute bottom-0" style={{ left: '50%', transform: 'translateX(-8%) translateY(3px)', zIndex: 2 }}>
            <div className="relative" style={{ width: chipSize + 4, height: frontCount * stackOffset + chipSize }}>
              <SingleStack count={frontCount} chipSize={chipSize} stackOffset={stackOffset} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShopPageContent() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null | 'loading'>('loading');
  const [gacha, setGacha] = useState<GachaState | null>(null);
  const [countdown, setCountdown] = useState<{ h: number; m: number; s: number } | null>(null);
  const [obtainedItemIds, setObtainedItemIds] = useState<Set<string>>(new Set());
  const [obtainedEquipmentIds, setObtainedEquipmentIds] = useState<Set<string>>(new Set());
  const [equipmentRatesOpen, setEquipmentRatesOpen] = useState(false);
  const [tenPullResults, setTenPullResults] = useState<{ item: { id: string; name: string; rarity: string }; equipment: { id: string; name: string; slotLabel: string; trait: string; rarity: string; effect: string; level: number } }[] | null>(null);
  const [tenPullLoading, setTenPullLoading] = useState(false);
  const [chipCheckoutError, setChipCheckoutError] = useState<string | null>(null);
  const [subscriptionCheckoutLoading, setSubscriptionCheckoutLoading] = useState<string | null>(null);
  const [subscriptionCheckoutError, setSubscriptionCheckoutError] = useState<string | null>(null);
  const [subscriptionCancelLoading, setSubscriptionCancelLoading] = useState(false);
  const [subscriptionCancelError, setSubscriptionCancelError] = useState<string | null>(null);
  const [subscriptionCancelSuccess, setSubscriptionCancelSuccess] = useState(false);
  const [staminaRecoverLoading, setStaminaRecoverLoading] = useState(false);
  const [staminaRecoverError, setStaminaRecoverError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [embedPackId, setEmbedPackId] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier | null>(null);
  const [iapChipLoading, setIapChipLoading] = useState<string | null>(null);
  const [iapSubLoading, setIapSubLoading] = useState<string | null>(null);
  const [iapRestoreLoading, setIapRestoreLoading] = useState(false);
  const searchParams = useSearchParams();

  const isAppStore = useIsAppStore();
  const { chipProducts, subProducts, loading: iapProductsLoading, error: iapProductsError } = useAppleIapProducts();

  const fetchSubscriptionStatus = () => {
    fetch('/api/profile/subscription-status', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.subscription_tier === 'pro' || data?.subscription_tier === 'ultra') {
          setSubscriptionTier(data.subscription_tier);
        } else {
          setSubscriptionTier('free');
        }
      })
      .catch(() => setSubscriptionTier('free'));
  };

  const fetchGacha = () => {
    fetch('/api/gacha', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then(setGacha)
      .catch(() => setGacha(null));
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        setSession(null);
        setSubscriptionTier('free');
        return;
      }
      const avatarUrl =
        (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null;
      setSession({ id: u.id, avatarUrl });
      fetchSubscriptionStatus();
    });
  }, []);

  useEffect(() => {
    if (purchaseSuccess) fetchSubscriptionStatus();
  }, [purchaseSuccess]);

  useEffect(() => {
    const success = searchParams.get('success');
    const cancel = searchParams.get('cancel');
    if (success === '1') {
      setPurchaseSuccess(true);
      window.dispatchEvent(new CustomEvent('gems-updated'));
      router.replace('/shop', { scroll: false });
    }
    if (cancel === '1') {
      router.replace('/shop', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!purchaseSuccess) return;
    const t = setTimeout(() => setPurchaseSuccess(false), 5000);
    return () => clearTimeout(t);
  }, [purchaseSuccess]);

  useEffect(() => {
    if (session === null) {
      router.replace('/login');
      return;
    }
  }, [session, router]);

  useEffect(() => {
    if (session === 'loading' || typeof session !== 'object') return;
    fetchGacha();
  }, [session]);

  useEffect(() => {
    if (session === 'loading' || typeof session !== 'object') return;
    Promise.all([
      fetch('/api/inventory', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/equipment', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([invJson, equipJson]) => {
      const itemIds = new Set<string>();
      for (const it of invJson?.items ?? []) {
        if (it?.id) itemIds.add(it.id);
      }
      setObtainedItemIds(itemIds);
      const equipIds = new Set<string>();
      for (const it of equipJson?.items ?? []) {
        if (it?.id) equipIds.add(it.id);
      }
      setObtainedEquipmentIds(equipIds);
    }).catch(() => {});
  }, [session]);

  const handleGachaPull = async (type: 'free' | 'paid') => {
    const res = await fetch('/api/gacha/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.equipment) {
      fetchGacha();
      if (type === 'paid') {
        window.dispatchEvent(new CustomEvent('gems-updated'));
        if (typeof json.paidGachaPity === 'number') {
          setGacha((g) => (g ? { ...g, paidGachaPity: json.paidGachaPity } : g));
        }
      }
      setObtainedEquipmentIds((prev) => new Set([...prev, json.equipment.id]));
      return {
        item: null,
        equipment: {
          id: json.equipment.id,
          name: json.equipment.name,
          slotLabel: json.equipment.slotLabel ?? '装備',
          trait: json.equipment.trait ?? '',
          effect: json.equipment.effect ?? '',
          level: json.equipment.level,
        },
      };
    }
    const msg = json?.error ?? '引けませんでした';
    throw new Error(msg);
  };

  const handleGachaPull10 = async () => {
    setTenPullLoading(true);
    setTenPullResults(null);
    try {
      const res = await fetch('/api/gacha/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'paid', count: 10 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? '10連に失敗しました');
      }
      if (Array.isArray(json.results) && json.results.length === 10) {
        setTenPullResults(json.results);
        if (typeof json.paidGachaPity === 'number') {
          setGacha((g) => (g ? { ...g, paidGachaPity: json.paidGachaPity } : g));
        }
        window.dispatchEvent(new CustomEvent('gems-updated'));
        fetchGacha();
        const equipIds = new Set(obtainedEquipmentIds);
        json.results.forEach((r: { equipment: { id: string } }) => {
          if (r.equipment) equipIds.add(r.equipment.id);
        });
        setObtainedEquipmentIds(equipIds);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '10連に失敗しました');
    } finally {
      setTenPullLoading(false);
    }
  };

  useEffect(() => {
    if (!gacha || gacha.freePullsLeft > 0) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const rem = Math.max(0, gacha.nextFreeAt - now);
      setCountdown({
        h: Math.floor(rem / 3600000),
        m: Math.floor((rem % 3600000) / 60000),
        s: Math.floor((rem % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gacha?.nextFreeAt, gacha?.freePullsLeft]);

  if (session === 'loading' || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)]/70 border-t-transparent" aria-hidden />
          <LoadingWithPercent className="text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black shop-bg">
      <AppHeader />

      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto max-w-lg">
          <h1 className="font-serif text-2xl font-bold tracking-[0.2em] text-[var(--gold)] sm:text-3xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>LOUNGE</h1>
          <p className="mt-1 text-sm text-zinc-500">チップでルーレット・取引</p>

          {/* ルーレット（メイン・主役） */}
          <section className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">ルーレット</h2>
            <div className="mt-3 rounded-2xl shop-glass p-4">
              {gacha?.freePullsLeft ? (
                <>
                  <p className="text-center text-lg font-bold shop-neon-gold">今日の無料スピン あと {gacha.freePullsLeft} 回</p>
                  <p className="mt-1 text-center text-xs text-zinc-500">明日0:00にリセット</p>
                </>
              ) : countdown != null ? (
                <>
                  <p className="text-center text-sm text-zinc-400">あと</p>
                  <p className="mt-1 text-center text-2xl font-bold tabular-nums shop-neon-gold sm:text-3xl" style={{ fontFamily: 'Georgia, serif' }}>
                    {countdown.h}時間 {countdown.m}分 {countdown.s}秒
                  </p>
                  <p className="mt-1 text-center text-sm text-zinc-400">で無料スピン</p>
                </>
              ) : (
                <LoadingWithPercent className="block text-center text-zinc-400" />
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {/* 無料スピン */}
              <div className="flex flex-col rounded-2xl shop-glass p-4">
                <p className="text-center text-sm font-semibold text-white">無料スピン</p>
                <div className="min-h-[1.5rem] shrink-0" aria-hidden />
                <div className="mt-3 flex flex-1 justify-center">
                  <Roulette
                    onPull={() => handleGachaPull('free')}
                    disabled={gacha != null && gacha.freePullsLeft <= 0}
                    rateMultiplier={gacha?.rateMultiplier ?? 1}
                    label={`今日あと ${gacha?.freePullsLeft ?? 0} 回`}
                    obtainedItemIds={obtainedItemIds}
                    obtainedEquipmentIds={obtainedEquipmentIds}
                  />
                </div>
              </div>
              {/* 有料スピン */}
              <div className="flex flex-col rounded-2xl shop-glass border-[var(--gold)]/40 p-4">
                <p className="text-center text-sm font-semibold text-white">有料スピン</p>
                <div className="min-h-[1.5rem] shrink-0 flex items-center justify-center">
                  {typeof gacha?.paidGachaPity === 'number' && (
                    <p className="rounded px-2 py-0.5 text-center text-xs font-medium text-zinc-300 bg-black/30">
                      Lv16～20確定まで あと{Math.max(0, 50 - gacha.paidGachaPity)}回
                      {gacha.paidGachaPity > 0 && <span className="ml-1 text-zinc-500">({gacha.paidGachaPity}/50)</span>}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex flex-1 justify-center">
                  <Roulette
                    onPull={() => handleGachaPull('paid')}
                    label="1スピン"
                    cost="100 チップ"
                    rateMultiplier={gacha?.rateMultiplier ?? 1}
                    obtainedItemIds={obtainedItemIds}
                    obtainedEquipmentIds={obtainedEquipmentIds}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGachaPull10}
                  disabled={tenPullLoading}
                  className="mt-2 w-full rounded-xl border-2 border-[var(--gold)]/60 bg-[var(--gold)]/25 py-3 text-base font-bold text-[var(--gold-light)] shop-btn-neon hover:bg-[var(--gold)]/35 disabled:opacity-50 transition-shadow"
                >
                  {tenPullLoading ? '処理中…' : <><span className="block text-lg">10スピン</span><span className="block text-sm font-semibold opacity-95">900 チップ</span></>}
                </button>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl shop-glass">
              <button
                type="button"
                onClick={() => setEquipmentRatesOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-800/50"
                aria-expanded={equipmentRatesOpen}
              >
                <span className="text-sm font-medium text-zinc-400">排出・確率</span>
                <span className={`inline-block text-zinc-500 transition-transform ${equipmentRatesOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {gacha?.rateMultiplier && gacha.rateMultiplier > 1 && (
                <p className="px-4 pb-2 text-xs text-gold">メンバー/VIP会員 1.2倍適用中</p>
              )}
              {equipmentRatesOpen && (
                <div className="border-t border-gold-subtle px-4 pb-4 pt-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-600 text-left text-zinc-500">
                          <th className="py-2 pr-2 font-normal">装備</th>
                          <th className="py-2 font-normal">レアリティ</th>
                          <th className="py-2 font-normal">スロット</th>
                          <th className="py-2 font-normal">特性</th>
                          <th className="py-2 text-right font-normal">確率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(gacha?.equipment ?? []).map((it) => (
                          <tr key={it.id} className="border-b border-gold-subtle">
                            <td className="py-2 pr-2 text-white">{it.name}</td>
                            <td className="py-2">
                              <span className={it.rarity === 'SR' ? 'text-amber-300' : it.rarity === 'R' ? 'text-purple-400' : 'text-zinc-400'}>
                                {it.rarity}
                              </span>
                            </td>
                            <td className="py-2 text-zinc-400">{it.slotLabel}</td>
                            <td className="py-2 text-gold">{it.trait}</td>
                            <td className="py-2 text-right tabular-nums text-white">{it.currentRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          {tenPullResults && tenPullResults.length > 0 && (
            <div
              className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setTenPullResults(null)}
            >
              <div
                className="w-full max-h-[85vh] overflow-y-auto rounded-xl border border-gold-subtle bg-zinc-900 p-4 sm:max-w-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-white">10スピン結果</h3>

                <section className="mt-4">
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {tenPullResults.map((r: { equipment: { id: string; name?: string; level?: number } }, i: number) => (
                      <div
                        key={`equip-${i}`}
                        className="flex flex-col items-center gap-0.5 rounded-lg p-2"
                      >
                        <span className="line-clamp-2 text-center text-xs font-medium text-white">{r.equipment.name ?? r.equipment.id}</span>
                        <span className="text-[10px] text-zinc-400">Lv.{r.equipment.level ?? 1}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <button
                  type="button"
                  onClick={() => setTenPullResults(null)}
                  className="mt-4 w-full rounded-lg border border-gold-subtle py-2 text-sm text-gold"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* 取引 */}
          <section className="mt-8">
            <Link
              href="/exchange"
              className="flex items-center justify-center gap-2 rounded-xl shop-glass px-4 py-3 text-gold transition hover:border-[var(--gold)]/40"
            >
              <span className="font-medium">取引</span>
              <span className="text-xs text-zinc-400">XP→チップ・アイテム売買</span>
            </Link>
          </section>

          {/* CHIP REQUISITION：サイバー・カジノ資産調達 */}
          <section className="mt-8">
            <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[#C5A059]/90" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>CHIP REQUISITION</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {isAppStore ? 'App Store ではアプリ内課金（30%上乗せ価格）でチップを購入できます。' : 'スタミナ切れの際にショップで補充できます。Web版はStripeで決済します。'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-400">所持チップでスタミナ回復:</span>
              <button
                type="button"
                disabled={staminaRecoverLoading}
                onClick={async () => {
                  setStaminaRecoverError(null);
                  setStaminaRecoverLoading(true);
                  try {
                    const res = await fetch('/api/stamina', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ action: 'recover', amount: 1 }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setStaminaRecoverError(data.error ?? '回復に失敗しました');
                      return;
                    }
                    window.dispatchEvent(new Event('stamina-updated'));
                    window.dispatchEvent(new Event('gems-updated'));
                  } catch {
                    setStaminaRecoverError('通信エラーが発生しました');
                  } finally {
                    setStaminaRecoverLoading(false);
                  }
                }}
                className="rounded border border-[#C5A059]/50 bg-[#111111] px-3 py-1.5 text-sm font-medium text-[#C5A059] hover:bg-[#1a1a1a] disabled:opacity-50"
                style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
              >
                {staminaRecoverLoading ? '処理中…' : '4チップで1回復'}
              </button>
              {staminaRecoverError && (
                <span className="text-xs text-red-400">{staminaRecoverError}</span>
              )}
            </div>
            {purchaseSuccess && (
              <p className="mt-2 rounded-lg border border-emerald-600/50 bg-emerald-900/50 px-3 py-2 text-sm text-emerald-200">
                ご購入ありがとうございます。チップを付与しました。
              </p>
            )}
            {chipCheckoutError && (
              <p className="mt-2 rounded-lg border border-red-600/50 bg-red-900/50 px-3 py-2 text-sm text-red-200">
                {chipCheckoutError}
              </p>
            )}
            {isAppStore && iapProductsError && (
              <p className="mt-2 text-sm text-amber-400">{iapProductsError}</p>
            )}
            {isAppStore ? (
              <>
                {iapProductsLoading ? (
                  <p className="mt-4 text-sm text-zinc-500">商品を読み込み中…</p>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {chipProducts.map((product) => {
                      const isHighTier = product.chips >= 7000;
                      const loading = iapChipLoading === product.productIdentifier;
                      return (
                        <button
                          key={product.productIdentifier}
                          type="button"
                          disabled={!!iapChipLoading}
                          onClick={async () => {
                            setChipCheckoutError(null);
                            setIapChipLoading(product.productIdentifier);
                            try {
                              const result = await purchaseAppleChip(product.productIdentifier);
                              if ('error' in result) {
                                setChipCheckoutError(result.error);
                                return;
                              }
                              const res = await fetch('/api/shop/apple/verify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ receipt: result.receipt }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) {
                                setChipCheckoutError(data.error ?? 'チップの付与に失敗しました');
                                return;
                              }
                              setPurchaseSuccess(true);
                              window.dispatchEvent(new Event('gems-updated'));
                              setTimeout(() => setPurchaseSuccess(false), 5000);
                              fetchSubscriptionStatus();
                            } catch {
                              setChipCheckoutError('通信エラーが発生しました');
                            } finally {
                              setIapChipLoading(null);
                            }
                          }}
                          className={`shop-chip-card group relative flex flex-col rounded-xl border border-[rgba(197,160,89,0.4)] p-4 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${isHighTier ? 'shop-chip-card-high' : ''}`}
                          style={{
                            borderWidth: '0.5px',
                            background: isHighTier ? 'linear-gradient(180deg, rgba(20,8,5,0.98) 0%, #0d0503 100%)' : 'rgba(17,17,17,0.95)',
                          }}
                        >
                          <div className="relative z-10 h-14 mb-3 flex items-center justify-center">
                            <CasinoChipStack chips={product.chips} />
                          </div>
                          <span className="relative z-10 block text-base font-bold tabular-nums text-[#F0F0F0]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                            {product.chips.toLocaleString()} チップ
                          </span>
                          <span className="relative z-10 block text-[10px] uppercase tracking-wider text-zinc-500">{product.packId}</span>
                          <span
                            className="relative z-10 mt-3 block w-full rounded border border-[#C5A059]/50 bg-[#111111] py-2.5 text-center text-sm font-semibold tabular-nums text-[#C5A059] transition hover:bg-[#1a1a1a]"
                            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                          >
                            {loading ? '処理中…' : product.priceString}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  disabled={iapRestoreLoading || iapProductsLoading}
                  onClick={async () => {
                    setChipCheckoutError(null);
                    setIapRestoreLoading(true);
                    try {
                      const { verified, error: restoreErr } = await restoreApplePurchases();
                      if (restoreErr) setChipCheckoutError(restoreErr);
                      if (verified > 0) {
                        setPurchaseSuccess(true);
                        window.dispatchEvent(new Event('gems-updated'));
                        fetchSubscriptionStatus();
                        setTimeout(() => setPurchaseSuccess(false), 5000);
                      }
                    } finally {
                      setIapRestoreLoading(false);
                    }
                  }}
                  className="mt-3 w-full rounded-xl border border-zinc-600 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50 disabled:opacity-50"
                >
                  {iapRestoreLoading ? '復元中…' : '購入を復元'}
                </button>
              </>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CHIP_PACKS.map((pack) => {
                  const isHighTier = pack.chips >= 7000;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      disabled={!!embedPackId}
                      onClick={() => {
                        setChipCheckoutError(null);
                        setEmbedPackId(pack.id);
                      }}
                      className={`shop-chip-card group relative flex flex-col rounded-xl border border-[rgba(197,160,89,0.4)] p-4 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${isHighTier ? 'shop-chip-card-high' : ''}`}
                      style={{
                        borderWidth: '0.5px',
                        background: isHighTier ? 'linear-gradient(180deg, rgba(20,8,5,0.98) 0%, #0d0503 100%)' : 'rgba(17,17,17,0.95)',
                      }}
                    >
                      <div className="relative z-10 h-14 mb-3 flex items-center justify-center">
                        <CasinoChipStack chips={pack.chips} />
                      </div>
                      <span className="relative z-10 block text-base font-bold tabular-nums text-[#F0F0F0]" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
                        {pack.chips.toLocaleString()} チップ
                      </span>
                      <span className="relative z-10 block text-[10px] uppercase tracking-wider text-zinc-500">{pack.label}</span>
                      <span
                        className="relative z-10 mt-3 block w-full rounded border border-[#C5A059]/50 bg-[#111111] py-2.5 text-center text-sm font-semibold tabular-nums text-[#C5A059] transition hover:bg-[#1a1a1a]"
                        style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
                      >
                        ¥{pack.price.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* メンバーシップカード：メタルカード・VIPはホログラム縁 */}
          <section className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">メンバーシップ</h2>
            <div className="mt-3 rounded-2xl shop-glass overflow-hidden">
              <div className="border-b border-[var(--gold)]/20 px-4 py-3 flex items-center justify-between">
                <span className="text-zinc-400">現在のランク</span>
                <span className="font-semibold shop-neon-gold">
                  {TIER_DISPLAY_NAME[subscriptionTier ?? 'free']}
                </span>
              </div>
              {!isAppStore && subscriptionCancelSuccess && (
                <p className="mx-4 mt-2 text-sm text-emerald-400">解約手続きが完了しました。翌月末までメンバー特典をご利用いただけます。</p>
              )}
              {(subscriptionCheckoutError || subscriptionCancelError) && (
                <p className="mx-4 mt-2 text-sm text-red-400">{subscriptionCheckoutError ?? subscriptionCancelError}</p>
              )}
              {isAppStore && (subscriptionTier === 'pro' || subscriptionTier === 'ultra') && (
                <div className="px-4 pt-2">
                  <p className="text-xs text-zinc-500">解約・プラン変更はiPhoneの設定から行えます。</p>
                  <button
                    type="button"
                    onClick={() => openAppleSubscriptionManagement()}
                    className="mt-2 w-full rounded-xl border border-zinc-600 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/50"
                  >
                    サブスクリプションを管理
                  </button>
                </div>
              )}
              <div className="p-4 space-y-3">
                {isAppStore ? (
                  iapProductsLoading ? (
                    <p className="text-sm text-zinc-500">読み込み中…</p>
                  ) : (
                    subProducts
                      .filter((p) => p.planId !== (subscriptionTier ?? 'free'))
                      .map((product) => {
                        const plan = PLANS.find((pl) => pl.id === product.planId);
                        const loading = iapSubLoading === product.productIdentifier;
                        return (
                          <button
                            key={product.productIdentifier}
                            type="button"
                            disabled={!!iapSubLoading}
                            onClick={async () => {
                              setSubscriptionCheckoutError(null);
                              setIapSubLoading(product.productIdentifier);
                              try {
                                const result = await purchaseAppleSubscription(product.productIdentifier);
                                if ('error' in result) {
                                  setSubscriptionCheckoutError(result.error);
                                  return;
                                }
                                const res = await fetch('/api/shop/apple/verify', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ receipt: result.receipt }),
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  setSubscriptionCheckoutError(data.error ?? 'サブスクの反映に失敗しました');
                                  return;
                                }
                                fetchSubscriptionStatus();
                                window.dispatchEvent(new Event('gems-updated'));
                              } catch {
                                setSubscriptionCheckoutError('通信エラーが発生しました');
                              } finally {
                                setIapSubLoading(null);
                              }
                            }}
                            className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-opacity disabled:opacity-60 disabled:cursor-not-allowed ${product.planId === 'ultra' ? 'shop-card-vip shop-card-vip-edge' : 'shop-card-member'}`}
                          >
                            <div>
                              <p className="font-semibold text-white">{plan?.name ?? product.planId}</p>
                              <p className={`text-sm tabular-nums ${product.planId === 'ultra' ? 'text-[var(--gold-light)]' : 'text-[var(--gold)]'}`} style={{ fontFamily: product.planId === 'ultra' ? 'Georgia, serif' : undefined }}>{product.priceString}/月</p>
                              {plan && (
                                <p className="text-xs text-zinc-500">
                                  {plan.chips != null && <>{plan.chips.toLocaleString()} チップ付与 · </>}
                                  スタミナ {plan.stamina} · スピン {plan.spinsPerDay}回/日
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-medium shrink-0 text-gold">
                              {loading ? '処理中…' : '加入'}
                            </span>
                          </button>
                        );
                      })
                  )
                ) : (
                  PLANS.filter((p) => p.id !== (subscriptionTier ?? 'free')).map((plan) => {
                    const isDowngrade = plan.id === 'free' && (subscriptionTier === 'pro' || subscriptionTier === 'ultra');
                    const loading = isDowngrade ? subscriptionCancelLoading : subscriptionCheckoutLoading === plan.id;
                    const disabled = isDowngrade ? subscriptionCancelLoading : !!subscriptionCheckoutLoading;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        disabled={!!disabled}
                        onClick={async () => {
                          if (isDowngrade) {
                            setSubscriptionCheckoutError(null);
                            setSubscriptionCancelError(null);
                            setSubscriptionCancelLoading(true);
                            try {
                              const res = await fetch('/api/shop/cancel-subscription', {
                                method: 'POST',
                                credentials: 'include',
                              });
                              const json = await res.json().catch(() => ({}));
                              if (!res.ok) {
                                setSubscriptionCancelError(json.error ?? '解約の処理に失敗しました');
                                return;
                              }
                              setSubscriptionCancelError(null);
                              setSubscriptionCheckoutError(null);
                              setSubscriptionCancelSuccess(true);
                              setTimeout(() => setSubscriptionCancelSuccess(false), 5000);
                            } catch {
                              setSubscriptionCancelError('通信エラーが発生しました');
                            } finally {
                              setSubscriptionCancelLoading(false);
                            }
                            return;
                          }
                          setSubscriptionCheckoutError(null);
                          setSubscriptionCancelError(null);
                          setSubscriptionCheckoutLoading(plan.id);
                          try {
                            const res = await fetch('/api/shop/checkout-subscription', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ planId: plan.id }),
                            });
                            const json = await res.json().catch(() => ({}));
                            if (!res.ok) {
                              setSubscriptionCheckoutError(json.error ?? '決済の開始に失敗しました');
                              return;
                            }
                            if (json.url) {
                              window.location.href = json.url;
                              return;
                            }
                            setSubscriptionCheckoutError('決済ページの取得に失敗しました');
                          } catch {
                            setSubscriptionCheckoutError('通信エラーが発生しました');
                          } finally {
                            setSubscriptionCheckoutLoading(null);
                          }
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-opacity disabled:opacity-60 disabled:cursor-not-allowed ${isDowngrade ? 'shop-glass border border-zinc-600/50 hover:border-zinc-500' : plan.id === 'ultra' ? 'shop-card-vip shop-card-vip-edge' : 'shop-card-member'}`}
                      >
                        <div>
                          <p className="font-semibold text-white">{plan.name}</p>
                          {isDowngrade ? (
                            <p className="text-xs text-zinc-400">翌月末で解約されます。それまでメンバー特典をご利用いただけます。</p>
                          ) : (
                            <>
                              <p className={`text-sm tabular-nums ${plan.id === 'ultra' ? 'text-[var(--gold-light)]' : 'text-[var(--gold)]'}`} style={{ fontFamily: plan.id === 'ultra' ? 'Georgia, serif' : undefined }}>¥{plan.price.toLocaleString()}/月</p>
                              <p className="text-xs text-zinc-500">
                                {plan.chips != null && <>{plan.chips.toLocaleString()} チップ付与 · </>}
                                スタミナ {plan.stamina} · スピン {plan.spinsPerDay}回/日
                              </p>
                            </>
                          )}
                        </div>
                        <span className={`text-xs font-medium shrink-0 ${isDowngrade ? 'text-zinc-400' : 'text-gold'}`}>
                          {loading ? (isDowngrade ? '処理中…' : 'リダイレクト中…') : isDowngrade ? '翌月から解約' : 'アップグレード'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <p className="px-4 pb-4 text-xs text-zinc-500">{isAppStore ? '価格はApp Store（30%上乗せ）で表示されています。' : 'プラン変更はアプリ内またはサポートへ'}</p>
            </div>
          </section>

          <p className="mt-8 text-center">
            <Link href="/" className="text-sm text-gold hover:text-gold-bright">
              ← ホームへ
            </Link>
          </p>
        </div>
      </main>

      <EmbeddedCheckoutModal
        open={!!embedPackId}
        packId={embedPackId}
        onClose={() => setEmbedPackId(null)}
      />

      <BottomNav />
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center gap-3 bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)]/70 border-t-transparent" aria-hidden />
          <LoadingWithPercent className="text-white" />
        </div>
      }
    >
      <ShopPageContent />
    </Suspense>
  );
}
