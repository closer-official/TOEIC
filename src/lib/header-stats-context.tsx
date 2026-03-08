'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { computeCurrentStamina, getMaxStamina, type SubscriptionTier } from '@/lib/stamina';

const STORAGE_KEY = 'shun_header_stats';
const USER_STORAGE_KEY = 'shun_header_user';
const MAX_AGE_MS = 60 * 1000; // 1分以内のキャッシュだけ即時表示に使う
const USER_MAX_AGE_MS = 5 * 60 * 1000; // ユーザー名・アバターは5分キャッシュ（ページ遷移で再取得しない）

export type HeaderStats = {
  gems: number;
  stamina: number;
  maxStamina: number;
  nextRecoveryAt: number | null;
  recoveryIntervalMs: number | null;
  /** オフライン用メタ（?offline=1 で取得時） */
  offlineMeta?: {
    staminaCount: number;
    lastStaminaAt: string | null;
    subscriptionTier: string;
    evolutionStaminaBonus: number;
    recoverySpeedMultiplier: number;
  };
};

export type HeaderUser = {
  id: string;
  avatarUrl: string | null;
  username: string | null;
};

function loadFromStorage(): HeaderStats | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: HeaderStats };
    if (Date.now() - at > MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function saveToStorage(data: HeaderStats) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // ignore
  }
}

function loadUserFromStorage(): HeaderUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: HeaderUser };
    if (Date.now() - at > USER_MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function saveUserToStorage(data: HeaderUser) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // ignore
  }
}

type ContextValue = {
  stats: HeaderStats | null;
  user: HeaderUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

const HeaderStatsContext = createContext<ContextValue | null>(null);

export function HeaderStatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<HeaderStats | null>(() => loadFromStorage());
  const [user, setUser] = useState<HeaderUser | null>(() => loadUserFromStorage());
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const [staminaRes, gemsRes] = await Promise.all([
      fetch('/api/stamina?offline=1', { credentials: 'include' }),
      fetch('/api/gems', { credentials: 'include' }),
    ]);
    if (staminaRes.ok && gemsRes.ok) {
      const staminaJson = await staminaRes.json().catch(() => null);
      const gemsJson = await gemsRes.json().catch(() => null);
      const next: HeaderStats = {
        gems: Math.max(0, gemsJson?.gems ?? 0),
        stamina: staminaJson?.stamina ?? 0,
        maxStamina: staminaJson?.maxStamina ?? 50,
        nextRecoveryAt: staminaJson?.nextRecoveryAt ?? null,
        recoveryIntervalMs: staminaJson?.recoveryIntervalMs ?? null,
        ...(staminaJson?.offlineMeta && { offlineMeta: staminaJson.offlineMeta }),
      };
      setStats(next);
      saveToStorage({ ...next, offlineMeta: undefined });
      return;
    }

    // 実機で API cookie が不安定な場合のフォールバック: Supabase クライアントから直接取得
    const supabase = createClient();
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('gems, stamina_count, last_stamina_at, subscription_tier, is_subscriber, evolution_stamina_bonus')
      .eq('user_id', uid)
      .maybeSingle();
    const p = profile as {
      gems?: number;
      stamina_count?: number;
      last_stamina_at?: string | null;
      subscription_tier?: string | null;
      is_subscriber?: boolean | null;
      evolution_stamina_bonus?: number | null;
    } | null;
    const tier: SubscriptionTier =
      p?.subscription_tier === 'pro' || p?.subscription_tier === 'ultra'
        ? p.subscription_tier
        : (p?.is_subscriber ? 'pro' : 'free');
    const evoBonus = Math.max(0, Number(p?.evolution_stamina_bonus ?? 0));
    const { stamina, nextRecoveryAt } = computeCurrentStamina(
      Math.max(0, Number(p?.stamina_count ?? 0)),
      p?.last_stamina_at ?? null,
      tier,
      evoBonus
    );
    const maxStamina = getMaxStamina(tier) + evoBonus;
    const next: HeaderStats = {
      gems: Math.max(0, Number(p?.gems ?? 0)),
      stamina,
      maxStamina,
      nextRecoveryAt,
      recoveryIntervalMs: maxStamina > 0 ? Math.floor((24 * 60 * 60 * 1000) / maxStamina) : null,
    };
    setStats(next);
  }, []);

  const fetchUser = useCallback(async (uid: string, avatarUrl: string | null): Promise<HeaderUser> => {
    const supabase = createClient();
    const { data } = await supabase.from('profiles').select('username').eq('user_id', uid).maybeSingle();
    const username = (data as { username?: string | null } | null)?.username ?? null;
    const u: HeaderUser = { id: uid, avatarUrl, username };
    setUser(u);
    saveUserToStorage(u);
    return u;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session?.user) {
        setStats(null);
        setUser(null);
        setLoading(false);
        return;
      }
      const u = data.session.user;
      const avatarUrl = (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null;
      await Promise.all([fetchStats(), fetchUser(u.id, avatarUrl)]);
      if (!cancelled) setLoading(false);
    };
    run();
    const intervalMs = 60_000;
    const id = setInterval(() => run(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchStats, fetchUser]);

  const refetch = useCallback(async () => {
    await fetchStats();
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const u = data.session.user;
      const avatarUrl = (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null;
      await fetchUser(u.id, avatarUrl);
    }
  }, [fetchStats, fetchUser]);

  const value = useMemo(
    () => ({ stats, user, loading, refetch }),
    [stats, user, loading, refetch]
  );

  return (
    <HeaderStatsContext.Provider value={value}>
      {children}
    </HeaderStatsContext.Provider>
  );
}

export function useHeaderStats(): ContextValue {
  const ctx = useContext(HeaderStatsContext);
  return ctx ?? { stats: null, user: null, loading: true, refetch: async () => {} };
}
