'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { setApiBearerToken } from '@/lib/api-bearer';

const AUTH_CALLBACK_PATH = '/auth/callback';
const LAST_HANDLED_KEY = 'last_auth_callback_url';

function handleAuthUrl(url: string): void {
  if (!url.includes(AUTH_CALLBACK_PATH)) return;
  if (typeof window !== 'undefined') {
    try {
      const prev = localStorage.getItem(LAST_HANDLED_KEY);
      if (prev === url) return;
      localStorage.setItem(LAST_HANDLED_KEY, url);
    } catch {
      // ignore
    }
  }
  const q = url.indexOf('?');
  const query = q >= 0 ? url.slice(q) : '';
  window.location.href = `${AUTH_CALLBACK_PATH}${query}`;
}

/** iOS コールドスタートでは getLaunchUrl() が遅れて届くことがあるため、複数回試す */
const LAUNCH_URL_RETRY_DELAYS_MS = [0, 200, 500, 1000, 2000, 3500];

/**
 * Capacitor アプリで OAuth から戻ったとき、URL スキームでアプリが開くので
 * /auth/callback?code=xxx へ遷移し、クライアント側でセッション交換させる。
 * ビルド時 NEXT_PUBLIC_CAPACITOR_APP=1 のときは常にリスナー登録（runtime の Capacitor も併用）。
 */
export function AppAuthCallbackListener() {
  const handled = useRef(false);

  // API 呼び出し用 Bearer を常に最新化（実機クロスオリジン時の API 認証対策）
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setApiBearerToken(data.session?.access_token ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setApiBearerToken(s?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const isApp =
      process.env.NEXT_PUBLIC_CAPACITOR_APP === '1' ||
      (typeof window !== 'undefined' &&
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

    if (!isApp) return;

    import('@/lib/capacitor-app').then(({ App }) => {
      function tryHandleLaunchUrl(url: string | undefined) {
        if (handled.current || !url) return;
        if (url.includes(AUTH_CALLBACK_PATH)) {
          handled.current = true;
          handleAuthUrl(url);
        }
      }

      // コールドスタート: getLaunchUrl が遅れることがあるので複数回リトライ
      LAUNCH_URL_RETRY_DELAYS_MS.forEach((delay) => {
        const run = () => App.getLaunchUrl().then((result) => tryHandleLaunchUrl(result?.url));
        if (delay === 0) run();
        else setTimeout(run, delay);
      });

      // バックグラウンドから戻ったとき
      App.addListener('appUrlOpen', (event: { url: string }) => {
        tryHandleLaunchUrl(event.url);
      });
    }).catch(() => {
      // @capacitor/app が無い（Web のみビルド）場合は無視
    });
  }, []);

  return null;
}
