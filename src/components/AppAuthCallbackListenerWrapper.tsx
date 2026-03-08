'use client';

import dynamic from 'next/dynamic';

/** Capacitor 用 OAuth コールバック。ssr: false でクライアントのみ読み込み、@capacitor/app をサーバーで解決しない。 */
const AppAuthCallbackListener = dynamic(
  () =>
    import('@/components/AppAuthCallbackListener').then((m) => ({
      default: m.AppAuthCallbackListener,
    })),
  { ssr: false }
);

export function AppAuthCallbackListenerWrapper() {
  return <AppAuthCallbackListener />;
}
