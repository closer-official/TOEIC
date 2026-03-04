'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { playMenuBgmIfExists, stopMenuBgm, setMenuBgmVolume, stopAllBgmOnHide } from '@/lib/game-audio';

const STORAGE_KEY = 'shun_bgm_enabled';
const STORAGE_VOLUME = 'shun_bgm_volume';

type BgmContextValue = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
};

const BgmContext = createContext<BgmContextValue | null>(null);

function readStored(): { enabled: boolean; volume: number } {
  if (typeof window === 'undefined') return { enabled: false, volume: 0.35 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const enabled = raw === null ? false : raw === '1' || raw === 'true';
    const volRaw = localStorage.getItem(STORAGE_VOLUME);
    const volume = volRaw === null ? 0.35 : Math.max(0, Math.min(1, parseFloat(volRaw) || 0.35));
    return { enabled, volume };
  } catch {
    return { enabled: false, volume: 0.35 };
  }
}

export function BgmProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [enabled, setEnabledState] = useState(false);
  const [volume, setVolumeState] = useState(0.35);

  useEffect(() => {
    stopAllBgmOnHide();
  }, []);

  useEffect(() => {
    const { enabled: e, volume: v } = readStored();
    setEnabledState(e);
    setVolumeState(v);
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {}
    if (!v) stopMenuBgm();
    else playMenuBgmIfExists(readStored().volume);
  }, []);

  const setVolume = useCallback((v: number) => {
    const val = Math.max(0, Math.min(1, v));
    setVolumeState(val);
    try {
      localStorage.setItem(STORAGE_VOLUME, String(val));
    } catch {}
    setMenuBgmVolume(val);
  }, []);

  useEffect(() => {
    const isGame = pathname != null && pathname === '/game';
    if (!enabled || isGame) {
      stopMenuBgm();
      return;
    }
    playMenuBgmIfExists(volume);
  }, [pathname, enabled, volume]);

  const value: BgmContextValue = { enabled, setEnabled, volume, setVolume };
  return <BgmContext.Provider value={value}>{children}</BgmContext.Provider>;
}

export function useBgm(): BgmContextValue {
  const ctx = useContext(BgmContext);
  if (!ctx) {
    return {
      enabled: false,
      setEnabled: () => {},
      volume: 0.35,
      setVolume: () => {},
    };
  }
  return ctx;
}
