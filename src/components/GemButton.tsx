'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHeaderStats } from '@/lib/header-stats-context';

const GOLD = '#C5A059';

/** 真鍮縁取り・ブラックチップ（発光なし・厚み感） */
function BrassChipIcon() {
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold"
      style={{
        background: 'radial-gradient(ellipse 65% 65% at 45% 38%, #1a1510 0%, #0d0a08 100%)',
        border: '1px solid rgba(197,160,89,0.6)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
        color: GOLD,
        fontFamily: 'var(--font-playfair), Georgia, serif',
      }}
    >
      A
    </span>
  );
}

/** チップ表示。ヘッダー右端・真鍮チップアイコン・シリアル風字間 */
export function GemButton({ count: countProp }: { count?: number } = {}) {
  const pathname = usePathname();
  const { stats, loading, refetch } = useHeaderStats();

  useEffect(() => {
    const onUpdate = () => refetch();
    window.addEventListener('gems-updated', onUpdate);
    document.addEventListener('visibilitychange', onUpdate);
    return () => {
      window.removeEventListener('gems-updated', onUpdate);
      document.removeEventListener('visibilitychange', onUpdate);
    };
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [pathname, refetch]);

  const count =
    countProp !== undefined && countProp !== null
      ? countProp
      : (stats?.gems ?? 0);

  if (stats == null && loading && countProp == null) {
    return <div className="h-8 w-16 animate-pulse rounded bg-[#0a0a0a]" />;
  }

  return (
    <Link
      href="/shop"
      className="flex items-center gap-2 py-1 pl-2 pr-1 transition-opacity hover:opacity-90"
      aria-label={`Chips ${count}`}
    >
      <span className="flex shrink-0 items-center justify-center" aria-hidden>
        <BrassChipIcon />
      </span>
      <div className="flex flex-col items-end">
        <span
          className="text-[10px] uppercase tracking-wider opacity-80"
          style={{ color: GOLD, fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          Chips
        </span>
        <span
          className="min-w-[2.5rem] text-right text-xs tabular-nums"
          style={{
            color: GOLD,
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontWeight: 400,
            letterSpacing: '0.18em',
          }}
        >
          {count}
        </span>
      </div>
    </Link>
  );
}
