'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useHeaderStats } from '@/lib/header-stats-context';
import { useOffline } from '@/lib/offline-context';

const GOLD = '#C5A059';

/** 回復進捗時計：1周でスタミナ1回復。progress 0→1 で針が1周（12時から時計回り） */
function RecoveryClock({ progress }: { progress: number }) {
  const p = Math.min(1, Math.max(0, progress));
  const size = 36;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const needleLen = r * 0.72;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const startAngle = -90;
  const needleAngle = startAngle + p * 360;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={GOLD}
        strokeWidth="0.6"
        opacity="0.9"
      />
      {Array.from({ length: 12 }, (_, i) => {
        const a = startAngle + (i / 12) * 360;
        const ra = rad(a);
        const inner = r - 2;
        const x1 = cx + inner * Math.cos(ra);
        const y1 = cy + inner * Math.sin(ra);
        const x2 = cx + r * Math.cos(ra);
        const y2 = cy + r * Math.sin(ra);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth="0.45" opacity="0.85" />
        );
      })}
      <line
        x1={cx}
        y1={cy}
        x2={cx + needleLen * Math.cos(rad(needleAngle))}
        y2={cy + needleLen * Math.sin(rad(needleAngle))}
        stroke={GOLD}
        strokeWidth="0.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 次回復までの進捗 0〜1（満タン時は 1）を現在時刻から算出 */
function useRecoveryProgress(
  nextRecoveryAt: number | null,
  recoveryIntervalMs: number | null
): number {
  const [progress, setProgress] = useState(() => {
    if (nextRecoveryAt == null || recoveryIntervalMs == null || recoveryIntervalMs <= 0) return 1;
    const remaining = nextRecoveryAt - Date.now();
    if (remaining <= 0) return 1;
    return Math.min(1, Math.max(0, 1 - remaining / recoveryIntervalMs));
  });

  useEffect(() => {
    if (nextRecoveryAt == null || recoveryIntervalMs == null || recoveryIntervalMs <= 0) {
      setProgress(1);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const remaining = nextRecoveryAt - now;
      if (remaining <= 0) {
        setProgress(1);
        return;
      }
      setProgress(Math.min(1, Math.max(0, 1 - remaining / recoveryIntervalMs)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRecoveryAt, recoveryIntervalMs]);

  if (nextRecoveryAt == null || recoveryIntervalMs == null) return 1;
  return progress;
}

export function StaminaGauge() {
  const pathname = usePathname();
  const { stats, loading, refetch } = useHeaderStats();
  const { isOffline, effectiveOfflineStamina, offlineMaxStamina, saveStaminaMeta } = useOffline();
  const savedMetaRef = useRef(false);
  const nextRecoveryAt = stats?.nextRecoveryAt ?? null;
  const recoveryIntervalMs = stats?.recoveryIntervalMs ?? null;
  const recoveryProgress = useRecoveryProgress(nextRecoveryAt, recoveryIntervalMs);

  useEffect(() => {
    if (stats?.offlineMeta && !savedMetaRef.current) {
      savedMetaRef.current = true;
      saveStaminaMeta(stats.offlineMeta as Parameters<typeof saveStaminaMeta>[0]).catch(() => {});
    }
  }, [stats?.offlineMeta, saveStaminaMeta]);

  useEffect(() => {
    const onStaminaUpdated = () => refetch();
    const onVisibility = () => { if (document.visibilityState === 'visible') refetch(); };
    window.addEventListener('stamina-updated', onStaminaUpdated);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('stamina-updated', onStaminaUpdated);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [pathname, refetch]);

  if (stats == null && loading) return <div className="h-8 w-20 animate-pulse rounded bg-[#0a0a0a]" />;
  const stamina = isOffline && effectiveOfflineStamina != null ? effectiveOfflineStamina : (stats?.stamina ?? 0);
  const maxStamina = isOffline && offlineMaxStamina != null ? offlineMaxStamina : (stats?.maxStamina ?? 50);

  return (
    <div
      className="flex items-center gap-2"
      title={isOffline ? `Stamina ${stamina}/${maxStamina}（オフライン）` : `Stamina ${stamina}/${maxStamina}（時計1周で1回復）`}
      aria-label={`Stamina ${stamina}/${maxStamina}${isOffline ? ' オフライン' : ''}`}
    >
      <RecoveryClock progress={isOffline ? 1 : recoveryProgress} />
      <div className="flex flex-col items-end">
        <span
          className="text-[10px] uppercase tracking-wider opacity-80"
          style={{ color: GOLD, fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          Stamina
        </span>
        <span
          className="text-xs tabular-nums"
          style={{
            color: GOLD,
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontWeight: 300,
            letterSpacing: '0.02em',
          }}
        >
          {stamina} / {maxStamina}
        </span>
      </div>
    </div>
  );
}
