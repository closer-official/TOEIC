'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * アプリ（Capacitor）から OAuth コールバックで開かれたときに使用。
 * サーバールート（route.ts）は Web のリダイレクト用。アプリでは URL スキームで
 * アプリが開き、このページが /auth/callback?code=xxx で読み込まれるので、
 * クライアント側で exchangeCodeForSession してから / へリダイレクトする。
 */
function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'exchanging' | 'done' | 'error'>('exchanging');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      setMessage('認証コードがありません');
      return;
    }
    if (!isSupabaseConfigured()) {
      setStatus('error');
      setMessage('Supabase の設定がありません');
      return;
    }

    const supabase = createClient();
    supabase.auth
      .exchangeCodeForSession(code)
      .then(async () => {
        setStatus('done');
        const { data } = await supabase.auth.getSession();
        const isApp =
          process.env.NEXT_PUBLIC_CAPACITOR_APP === '1' ||
          (typeof window !== 'undefined' &&
            (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
        const at = data.session?.access_token;
        const rt = data.session?.refresh_token;
        if (isApp && at && rt) {
          window.location.replace(`/?app_at=${encodeURIComponent(at)}&app_rt=${encodeURIComponent(rt)}`);
          return;
        }
        window.location.replace('/');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.message ?? 'ログインの完了に失敗しました');
      });
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6">
      {status === 'exchanging' && (
        <p className="text-zinc-400">ログインを完了しています…</p>
      )}
      {status === 'done' && (
        <p className="text-amber-400">リダイレクトしています…</p>
      )}
      {status === 'error' && (
        <div className="text-center">
          <p className="text-red-400">{message}</p>
          <a href="/login" className="mt-4 inline-block text-sm text-gold hover:underline">
            ログイン画面へ
          </a>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-black">
        <p className="text-zinc-500">読み込み中…</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
