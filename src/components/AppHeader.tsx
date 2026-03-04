'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useHeaderStats } from '@/lib/header-stats-context';
import { StaminaGauge } from '@/components/StaminaGauge';
import { GemButton } from '@/components/GemButton';

type Props = {
  /** 指定時は左端に「← 戻る」を表示 */
  backHref?: string;
};

export function AppHeader({ backHref }: Props) {
  const { user } = useHeaderStats();

  useEffect(() => {
    if (!user) return;
    fetch('/api/profile/sync-avatar', { method: 'POST', credentials: 'include' }).catch(() => {});
  }, [user?.id]);

  return (
    <header
      className="header-mahogany header-brass-border fixed left-0 right-0 top-0 z-40 flex w-full shrink-0 items-center justify-between px-4 py-3 sm:px-6"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="shrink-0 text-gold hover:text-gold-bright"
            aria-label="戻る"
          >
            ←
          </Link>
        )}
        {user && (
          <Link
            href="/settings"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pr-2 transition-opacity hover:opacity-90 active:opacity-80"
            aria-label="設定"
          >
            <div
              className="header-avatar-frame relative shrink-0 overflow-hidden"
              style={{
                width: '2.6rem',
                height: '2.6rem',
                clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
                background: 'linear-gradient(145deg, #c9a227 0%, #8b6914 40%, #5c4a0e 100%)',
                padding: '2px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.35)',
              }}
            >
              <div
                className="h-full w-full overflow-hidden"
                style={{ clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' }}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-sm font-medium text-gold-bright">
                    {(user.username || user.id).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <span className="min-w-0 truncate text-sm font-medium tracking-wide text-white">
              {user.username?.trim() || 'ゲスト'}
            </span>
          </Link>
        )}
      </div>
      <div className="flex flex-1 items-center justify-end gap-4">
        <StaminaGauge />
        <GemButton />
      </div>
    </header>
  );
}
