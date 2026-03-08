'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

/** アプリ（Capacitor）用の OAuth リダイレクト先。Supabase ダッシュボードにも同じ URL を登録すること */
const APP_AUTH_CALLBACK_URL = 'com.toeic-sigma.shun://auth/callback';

function getAuthRedirectUrl(): string {
  // 実機ビルドではビルド時に NEXT_PUBLIC_CAPACITOR_APP=1 が入るので、runtime の Capacitor に依存しない
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_CAPACITOR_APP === '1') {
    return APP_AUTH_CALLBACK_URL;
  }
  if (typeof window === 'undefined') return '';
  if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
    return APP_AUTH_CALLBACK_URL;
  }
  return `${window.location.origin}/api/auth/callback`;
}

const ANTIQUE_GOLD = '#C5A059';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setError(decodeURIComponent(err));
  }, [searchParams]);

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      if (data.session?.user) router.replace('/');
    });
  }, [router]);

  // OAuth ポップアップ／タブ切替から戻ったときに loading を解除（戻ったあとタップできない不具合対策）
  useEffect(() => {
    const onVisible = () => setLoading(false);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // 実機: ログイン画面に戻ってきたときに getLaunchUrl を確認（AppAuthCallbackListener が取りこぼした場合のフォールバック）
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NEXT_PUBLIC_CAPACITOR_APP !== '1') return;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    import('@/lib/capacitor-app')
      .then(({ App }) => {
        const check = () =>
          App.getLaunchUrl().then((r) => {
            const url = typeof r?.url === 'string' ? r.url : '';
            if (url.includes('/auth/callback')) {
              const q = url.indexOf('?');
              const query = q >= 0 ? url.slice(q) : '';
              window.location.href = `/auth/callback${query}`;
            }
          });
        check();
        timeoutId = setTimeout(check, 500);
      })
      .catch(() => {});
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const supabase = createClient();

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    if (!isSupabaseConfigured()) {
      setError(
        'Supabase の設定がありません。Web は Vercel の環境変数、実機・iOS ビルドの場合はビルド前に .env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してから npm run build:ios を実行してください。'
      );
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthRedirectUrl(),
        },
      });
      if (err) throw err;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログインに失敗しました');
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    if (!isSupabaseConfigured()) {
      setError(
        'Supabase の設定がありません。Web は Vercel の環境変数、実機・iOS ビルドの場合はビルド前に .env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してから npm run build:ios を実行してください。'
      );
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.signInAnonymously();
      if (err) throw err;
      // アプリでは router だけだとホームで getSession() がまだ null のままになり /login に戻されることがあるため、フルリロードで確実にセッションを読ませる
      const isApp = process.env.NEXT_PUBLIC_CAPACITOR_APP === '1' || (typeof window !== 'undefined' && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
      if (isApp) {
        window.location.href = '/';
        return;
      }
      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-casino relative flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-black px-4 py-12 safe-area-pad">
      {/* 金の二重線フレーム（画面全体を囲む） */}
      <div className="login-double-border pointer-events-none fixed inset-4 z-10 sm:inset-6" aria-hidden />
      <div className="login-double-border pointer-events-none fixed inset-6 z-10 sm:inset-8" aria-hidden />

      <div className="relative z-0 flex w-full max-w-sm flex-col items-center">
        {/* ロゴ：セリフ体・金箔グラデーション・ドロップシャドウ */}
        <header className="mb-12 text-center">
          <h1
            className="login-logo text-3xl font-medium tracking-[0.12em] sm:text-4xl"
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              background: `linear-gradient(180deg, ${ANTIQUE_GOLD} 0%, #a88b45 40%, #8b7340 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            }}
          >
            All-in ENGLISH
          </h1>
          <p
            className="mt-3 text-sm tracking-[0.15em] text-zinc-500"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            知性を、全賭け（オールイン）せよ。
          </p>
        </header>

        {/* ボタン群 */}
        <div className="flex w-full flex-col gap-4">
          {error && (
            <p className="text-center text-xs text-amber-200/90">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            disabled={loading}
            className="login-oauth-btn touch-target flex w-full items-center justify-center gap-3 rounded py-3.5 transition active:opacity-90 disabled:opacity-50"
          >
            <span aria-hidden>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" style={{ color: ANTIQUE_GOLD }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </span>
            <span className="text-sm tracking-wide" style={{ color: ANTIQUE_GOLD }}>
              Google でログイン
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('apple')}
            disabled={loading}
            className="login-oauth-btn touch-target flex w-full items-center justify-center gap-3 rounded py-3.5 transition active:opacity-90 disabled:opacity-50"
          >
            <span aria-hidden>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: ANTIQUE_GOLD }}>
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
            </span>
            <span className="text-sm tracking-wide" style={{ color: ANTIQUE_GOLD }}>
              Apple でログイン
            </span>
          </button>

          <div className="flex items-center py-2" aria-hidden>
            <div className="flex-1 border-t border-[#C5A059]/30" />
            <span className="px-3 text-[10px] tracking-[0.2em] text-zinc-600">or</span>
            <div className="flex-1 border-t border-[#C5A059]/30" />
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="login-guest-btn touch-target w-full rounded border py-3.5 transition active:opacity-90 disabled:opacity-50"
            style={{
              borderColor: 'rgba(197,160,89,0.5)',
              background: 'transparent',
              color: ANTIQUE_GOLD,
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontSize: '0.8rem',
              letterSpacing: '0.18em',
            }}
          >
            ゲストログイン
          </button>
        </div>
      </div>

      {/* 法的文言：画面最下部・極小 */}
      <footer className="fixed bottom-0 left-0 right-0 z-0 border-t border-[#C5A059]/15 bg-black/90 py-2 safe-area-pad">
        <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 text-[9px] tracking-wider text-zinc-600" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>
          <Link href="/terms" className="hover:text-[#C5A059]/80">利用規約</Link>
          <span className="text-zinc-700">|</span>
          <Link href="/privacy" className="hover:text-[#C5A059]/80">プライバシーポリシー</Link>
          <span className="text-zinc-700">|</span>
          <Link href="/tokusho" className="hover:text-[#C5A059]/80">特定商取引法に基づく表記</Link>
        </nav>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C5A059]/50 border-t-transparent" aria-hidden />
          <span className="text-sm text-zinc-500">読み込み中…</span>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
