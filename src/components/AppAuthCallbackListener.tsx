'use client';

import { useEffect } from 'react';

const AUTH_CALLBACK_PATH = '/auth/callback';

function handleAuthUrl(url: string): void {
  if (!url.includes(AUTH_CALLBACK_PATH)) return;
  const q = url.indexOf('?');
  const query = q >= 0 ? url.slice(q) : '';
  window.location.href = `${AUTH_CALLBACK_PATH}${query}`;
}

/**
 * Capacitor アプリで OAuth から戻ったとき、URL スキームでアプリが開くので
 * /auth/callback?code=xxx へ遷移し、クライアント側でセッション交換させる。
 * ビルド時 NEXT_PUBLIC_CAPACITOR_APP=1 のときは常にリスナー登録（runtime の Capacitor も併用）。
 */
export function AppAuthCallbackListener() {
  useEffect(() => {
    const isApp =
      process.env.NEXT_PUBLIC_CAPACITOR_APP === '1' ||
      (typeof window !== 'undefined' &&
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

    if (!isApp) return;

    import('@capacitor/app').then(({ App }) => {
      // コールドスタートで URL で起動した場合に getLaunchUrl で取れることがある
      App.getLaunchUrl().then((result) => {
        if (result?.url) handleAuthUrl(result.url);
      });

      App.addListener('appUrlOpen', (event: { url: string }) => {
        handleAuthUrl(event.url);
      });
    }).catch(() => {
      // @capacitor/app が無い（Web のみビルド）場合は無視
    });
  }, []);

  return null;
}
