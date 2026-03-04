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

const STORAGE_KEY = 'shun_header_stats';
const USER_STORAGE_KEY = 'shun_header_user';
const MAX_AGE_MS = 60 * 1000; // 1分以内のキャッシュだけ即時表示に使う
const USER_MAX_AGE_MS = 5 * 60 * 1000; // ユーザー名・アバターは5分キャッシュ（ページ遷移で再取得しない）

export type HeaderStats = {
  gems: number;
  stamina: number;
  maxStamina: number;
  nextRecoveryAt: number | null;
  /** 1スタミナ回復までの間隔（ms）。満タン時は null */
  recoveryIntervalMs: number | null;
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
      fetch('/api/stamina', { credentials: 'include' }),
      fetch('/api/gems', { credentials: 'include' }),
    ]);
    const staminaJson = staminaRes.ok ? await staminaRes.json().catch(() => null) : null;
    const gemsJson = gemsRes.ok ? await gemsRes.json().catch(() => null) : null;
    const next: HeaderStats = {
      gems: Math.max(0, gemsJson?.gems ?? 0),
      stamina: staminaJson?.stamina ?? 0,
      maxStamina: staminaJson?.maxStamina ?? 50,
      nextRecoveryAt: staminaJson?.nextRecoveryAt ?? null,
      recoveryIntervalMs: staminaJson?.recoveryIntervalMs ?? null,
    };
    setStats(next);
    saveToStorage(next);
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
