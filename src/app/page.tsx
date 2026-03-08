'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { OnboardingModal, type OnboardingForm } from '@/components/OnboardingModal';
import { AppHeader } from '@/components/AppHeader';
import { HomeSideButtons, HomeNavInline, hasSideNavItems } from '@/components/HomeSideButtons';
import { BottomNav } from '@/components/BottomNav';
import { IconPart5, IconVocab, IconEvent } from '@/components/ModeIcons';
const SWIPE_THRESHOLD = 50;
const TOTAL_PAGES = 3;

type SessionUser = { id: string; avatarUrl: string | null };

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null | 'loading'>('loading');
  const [authReady, setAuthReady] = useState(false);
  const [showGuestRetryPrompt, setShowGuestRetryPrompt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [rankingPreview, setRankingPreview] = useState<{ rank: number; score: number; username: string | null; avatar_url: string | null }[]>([]);
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; body: string; createdAt: string }[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [mouseDown, setMouseDown] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const mouseStartY = useRef<number | null>(null);
  const authReadyRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    const applySession = async () => {
      const { data } = await supabase.auth.getSession();
        const u = data.session?.user;
        if (!u) {
          setSession(null);
          return false;
        }
        const avatarUrl =
          (u.user_metadata?.avatar_url as string) ??
          (u.user_metadata?.picture as string) ??
          null;
        setSession({ id: u.id, avatarUrl });
        return true;
    };
    const markAuthReady = () => {
      authReadyRef.current = true;
      setAuthReady(true);
    };
    // 実機: ログイン直後に URL で渡されたトークンを最優先で取り込み、すぐ URL を掃除する
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const at = params.get('app_at');
      const rt = params.get('app_rt');
      if (at && rt) {
        supabase.auth
          .setSession({ access_token: at, refresh_token: rt })
          .then(() => applySession())
          .finally(() => markAuthReady())
          .finally(() => {
            params.delete('app_at');
            params.delete('app_rt');
            const next = params.toString();
            const cleanUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
            window.history.replaceState({}, '', cleanUrl);
          });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
          const u = s?.user;
          if (!u) {
            if (!authReadyRef.current) return;
            setSession(null);
            return;
          }
          const avatarUrl =
            (u.user_metadata?.avatar_url as string) ??
            (u.user_metadata?.picture as string) ??
            null;
          setSession({ id: u.id, avatarUrl });
        });
        return () => subscription.unsubscribe();
      }
    }
    // アプリ: フルリロード後のゲストセッションを Preferences から復元してから getSession
    import('@/lib/app-session-bridge').then(({ restoreSessionFromBridge }) => {
      restoreSessionFromBridge(async (s) => {
        const { error } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
        if (error) throw error;
      }).then(async (restored) => {
        if (restored) {
          await applySession();
          markAuthReady();
          return;
        }
        await applySession();
        markAuthReady();
      });
    }).catch(async () => {
      await applySession();
      markAuthReady();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      const u = s?.user;
      if (!u) {
        if (!authReadyRef.current) return;
        setSession(null);
        return;
      }
      const avatarUrl =
        (u.user_metadata?.avatar_url as string) ??
        (u.user_metadata?.picture as string) ??
        null;
      setSession({ id: u.id, avatarUrl });
    });
    return () => subscription.unsubscribe();
  }, []);

  // session が null のとき長めに再取得。アプリでは自動で /login に飛ばさず「ゲストログインをもう一度」を表示してループを防ぐ
  const hasTriedRedirect = useRef(false);
  useEffect(() => {
    if (!authReady) return;
    if (session !== null) return;
    if (hasTriedRedirect.current) return;
    const isApp = typeof window !== 'undefined' && (
      process.env.NEXT_PUBLIC_CAPACITOR_APP === '1' ||
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
    );
    let cancelled = false;
    const run = async () => {
      for (const waitMs of [600, 1200, 2400]) {
        await new Promise((r) => setTimeout(r, waitMs));
        if (cancelled) return;
        const { data } = await createClient().auth.getSession();
        if (data.session?.user) {
          const u = data.session.user;
          const avatarUrl = (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null;
          setSession({ id: u.id, avatarUrl });
          return;
        }
      }
      if (!cancelled && !hasTriedRedirect.current) {
        hasTriedRedirect.current = true;
        if (isApp) {
          setShowGuestRetryPrompt(true);
        } else {
          router.replace('/login');
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [authReady, session, router]);

  useEffect(() => {
    fetch('/api/ranking/preview', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { runs: [] }))
      .then((data) => setRankingPreview(data.runs ?? []))
      .catch(() => setRankingPreview([]));
    fetch('/api/announcements', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setAnnouncements(json?.items ?? []))
      .catch(() => setAnnouncements([]));
  }, []);

  // ログイン済みでプロフィールがなければオンボーディング表示 & ヘッダー用ユーザー名
  useEffect(() => {
    if (session === 'loading' || session === null || typeof session !== 'object') return;
    const load = async () => {
      try {
        const { data } = await createClient()
          .from('profiles')
          .select('user_id, username')
          .eq('user_id', session.id)
          .maybeSingle();
        setShowOnboarding(!data);
      } catch {
        setShowOnboarding(true);
      }
    };
    load();
  }, [session]);

  const handleOnboardingSkip = async () => {
    if (session === 'loading' || session === null || typeof session !== 'object') return;
    setOnboardingLoading(true);
    setProfileSaveError(null);
    const { error } = await createClient().from('profiles').upsert(
      { user_id: session.id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    setOnboardingLoading(false);
    if (error) {
      setProfileSaveError(error.message);
      return;
    }
    setShowOnboarding(false);
  };

  const handleOnboardingSubmit = async (form: OnboardingForm) => {
    if (session === 'loading' || session === null || typeof session !== 'object') return;
    setOnboardingLoading(true);
    setProfileSaveError(null);
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username.trim(),
        current_toeic_score: form.current_toeic_score.trim(),
        target_toeic_score: form.target_toeic_score.trim(),
        next_exam_date: form.next_exam_date.trim(),
        closer_id: form.closer_id.trim(),
        referrer_id: form.referrer_id.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setOnboardingLoading(false);
    if (!res.ok) {
      setProfileSaveError(data.error ?? '保存に失敗しました');
      return;
    }
    setShowOnboarding(false);
  };

  const goToPage = useCallback((next: number) => {
    if (next < 0 || next >= TOTAL_PAGES) return;
    setPageIndex(next);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const endY = e.changedTouches[0]?.clientY;
    const start = touchStartY.current;
    touchStartY.current = null;
    if (start == null || endY == null) return;
    const delta = start - endY;
    if (delta > SWIPE_THRESHOLD) {
      goToPage(pageIndex + 1);
    } else if (delta < -SWIPE_THRESHOLD) {
      goToPage(pageIndex - 1);
    }
  }, [pageIndex, goToPage]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseStartY.current = e.clientY;
    setMouseDown(true);
  }, []);

  useEffect(() => {
    if (!mouseDown) return;
    const onMouseUp = (e: MouseEvent) => {
      const start = mouseStartY.current;
      mouseStartY.current = null;
      setMouseDown(false);
      if (start == null) return;
      const delta = start - e.clientY;
      if (delta > SWIPE_THRESHOLD) {
        setPageIndex((i) => (i + 1 < TOTAL_PAGES ? i + 1 : i));
      } else if (delta < -SWIPE_THRESHOLD) {
        setPageIndex((i) => (i - 1 >= 0 ? i - 1 : i));
      }
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [mouseDown]);

  if (session === 'loading' || session === null) {
    if (showGuestRetryPrompt) {
      return (
        <div className="flex min-h-screen items-center justify-center home-bg">
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <p className="text-sm text-zinc-400">セッションを読み込めませんでした。</p>
            <p className="text-xs text-zinc-500">アプリでは反映に時間がかかることがあります。</p>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="rounded border border-[var(--gold)]/50 bg-[var(--gold)]/10 px-6 py-3 text-sm text-[var(--gold)]"
            >
              ゲストログインをもう一度
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center home-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)]/70 border-t-transparent" aria-hidden />
          <span className="text-sm text-zinc-400">読み込み中…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] min-h-screen flex-col items-center justify-start overflow-hidden">
      {/* 全面に質感背景（スワイプでバー下に白が出ないように） */}
      <div className="fixed inset-0 z-0 home-bg" aria-hidden />

      <AppHeader />
      <div className="relative z-10 mt-16 flex min-h-0 flex-1 flex-col w-full px-4 pb-24 safe-area-pad sm:px-6">
        <HomeSideButtons />

        {hasSideNavItems && (
          <div className="w-full shrink-0 border-b border-gold-subtle bg-[#0a1612]/90 py-3 md:hidden">
            <HomeNavInline />
          </div>
        )}

        {/* 3パネルを縦に並べて translate でスライド（全ページ常にDOMにあり確実に表示） */}
        <div
          className="relative flex-1 min-h-[50vh] w-full overflow-hidden overscroll-none touch-pan-y"
          style={{ overscrollBehavior: 'none' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <motion.div
            className="flex flex-col w-full"
            style={{ height: '300%' }}
            animate={{ translateY: `-${pageIndex * (100 / 3)}%` }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* ページ0: プレイカード（Glassmorphism・真鍮ボーダー・セリフ体） */}
            <div className="h-[33.333%] min-h-0 w-full shrink-0 overflow-y-auto flex flex-col items-center pt-4 pb-16 px-4 md:pl-24 md:pr-10" style={{ overscrollBehavior: 'none' }}>
              <div className="flex w-full max-w-sm flex-col gap-5">
                <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-[#D4AF37]/90">プレイ</p>
                <div className="flex flex-col gap-5">
                  <Link href="/game?mode=part5-national" className="touch-target group flex items-center gap-3 rounded-xl border py-4 pl-4 pr-5 text-left transition-all active:opacity-90 sm:py-5 brass-card" aria-label="Part 5 全国モード">
                    <span className="shrink-0 text-gold group-hover:text-gold-bright transition-colors" aria-hidden><IconPart5 className="w-10 h-10" /></span>
                    <div className="min-w-0 flex-1">
                      <span className="block font-semibold text-white sm:text-lg group-hover:text-[#D4AF37]/95" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>Part 5 全国モード</span>
                      <span className="mt-1 block border-b border-white/30 pb-1.5" style={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                      <span className="text-xs text-zinc-400">全国共通の問題でタイムアタック</span>
                    </div>
                  </Link>
                  <Link href="/game?mode=vocab-national" className="touch-target group flex items-center gap-3 rounded-xl border py-4 pl-4 pr-5 text-left transition-all active:opacity-90 sm:py-5 brass-card" aria-label="単語全国モード">
                    <span className="shrink-0 text-gold group-hover:text-gold-bright transition-colors" aria-hidden><IconVocab className="w-10 h-10" /></span>
                    <div className="min-w-0 flex-1">
                      <span className="block font-semibold text-white sm:text-lg group-hover:text-[#D4AF37]/95" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>単語 全国モード</span>
                      <span className="mt-1 block border-b border-white/30 pb-1.5" style={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                      <span className="text-xs text-zinc-400">数千語からランダム出題</span>
                    </div>
                  </Link>
                  <Link href="/event" className="touch-target group flex items-center gap-3 rounded-xl border py-4 pl-4 pr-5 text-left transition-all active:opacity-90 sm:py-5 brass-card" aria-label="イベント・大会">
                    <span className="shrink-0 text-gold group-hover:text-gold-bright transition-colors" aria-hidden><IconEvent className="w-10 h-10" /></span>
                    <div className="min-w-0 flex-1">
                      <span className="block font-semibold text-white sm:text-lg group-hover:text-[#D4AF37]/95" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>イベント・大会</span>
                      <span className="mt-1 block border-b border-white/30 pb-1.5" style={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                      <span className="text-xs text-zinc-400">週替わりイベントと日曜大会</span>
                    </div>
                  </Link>
                  <Link href="/game?mode=vocab-word-national" className="touch-target group flex items-center gap-3 rounded-xl border py-4 pl-4 pr-5 text-left transition-all active:opacity-90 sm:py-5 brass-card" aria-label="単語→単語">
                    <span className="shrink-0 text-gold group-hover:text-gold-bright transition-colors" aria-hidden><IconVocab className="w-10 h-10" /></span>
                    <div className="min-w-0 flex-1">
                      <span className="block font-semibold text-white sm:text-lg group-hover:text-[#D4AF37]/95" style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}>単語→単語</span>
                      <span className="mt-1 block border-b border-white/30 pb-1.5" style={{ borderColor: 'rgba(255,255,255,0.3)' }} />
                      <span className="text-xs text-zinc-400">英単語で同じ意味の英単語を選ぶ</span>
                    </div>
                  </Link>
                </div>
                <p className="mt-4 text-center text-xs text-zinc-500 flex items-center justify-center gap-1.5" aria-hidden>
                  <span className="inline-block translate-y-0.5">↓</span>
                  <span>下にスワイプでランキング・掲示板</span>
                </p>
              </div>
            </div>

            {/* ページ1: ランキング */}
            <div className="h-[33.333%] min-h-0 w-full shrink-0 overflow-y-auto flex flex-col items-center pt-4 pb-16 px-4 md:pl-24 md:pr-10" style={{ overscrollBehavior: 'none' }}>
              <div className="w-full max-w-sm">
                <h2 className="text-base font-semibold text-white">ランキング</h2>
                <p className="mt-0.5 text-xs text-zinc-500">単語＋Part 5 合計得点 上位</p>
                {rankingPreview.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 px-4 py-6 text-center text-sm text-zinc-500">まだ記録がありません</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {rankingPreview.slice(0, 10).map((r) => (
                      <li key={r.rank} className="flex items-center gap-3 rounded-xl border border-gold-subtle bg-zinc-900/80 px-4 py-3">
                        <span className="shrink-0 text-lg font-bold text-gold">#{r.rank}</span>
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-700">
                          {r.avatar_url?.trim() ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="flex h-full w-full items-center justify-center text-xs font-medium text-zinc-400">{(r.username?.trim() || '?').slice(0, 1).toUpperCase()}</span>}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-white text-sm">{r.username?.trim() || '匿名'}</span>
                        <span className="shrink-0 font-medium text-white text-sm">{r.score} pt</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-center"><Link href="/ranking" className="text-sm text-gold hover:text-gold-bright">ランキング・掲示板を見る →</Link></p>
              </div>
            </div>

            {/* ページ2: 掲示板 */}
            <div className="h-[33.333%] min-h-0 w-full shrink-0 overflow-y-auto flex flex-col items-center pt-4 pb-16 px-4 md:pl-24 md:pr-10" style={{ overscrollBehavior: 'none' }}>
              <div className="w-full max-w-sm">
                <h2 className="text-base font-semibold text-white">掲示板</h2>
                <p className="mt-0.5 text-xs text-zinc-500">運営からのお知らせ</p>
                {announcements.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 px-4 py-6 text-center text-sm text-zinc-500">お知らせはありません</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {announcements.slice(0, 5).map((a) => (
                      <li key={a.id} className="rounded-xl border border-gold-subtle bg-zinc-900/80 px-4 py-3">
                        <p className="font-medium text-white">{a.title}</p>
                        <p className="mt-1 line-clamp-2 break-words text-sm text-zinc-400">{a.body}</p>
                        <p className="mt-2 text-xs text-zinc-500">{new Date(a.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-center"><Link href="/ranking" className="text-sm text-gold hover:text-gold-bright">掲示板をすべて見る →</Link></p>
              </div>
            </div>
          </motion.div>

          {/* ページインジケーター（スワイプ先が分かるようラベル付き） */}
          <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-2 z-10">
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <button key={i} type="button" onClick={() => goToPage(i)} className="p-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-label={i === 0 ? 'メイン' : i === 1 ? 'ランキング' : '掲示板'} aria-current={pageIndex === i ? 'true' : undefined}>
                  <span className={`block h-2 rounded-full transition-all duration-200 ${pageIndex === i ? 'w-5 bg-[var(--gold)]' : 'w-2 bg-zinc-500/80'}`} />
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 tabular-nums">
              {pageIndex === 0 && 'メイン'}
              {pageIndex === 1 && 'ランキング'}
              {pageIndex === 2 && '掲示板'}
            </p>
          </div>
        </div>
      </div>

      <BottomNav />
      <OnboardingModal
        open={showOnboarding}
        onSkip={handleOnboardingSkip}
        onSubmit={handleOnboardingSubmit}
        loading={onboardingLoading}
        saveError={profileSaveError}
        onDismissError={() => setProfileSaveError(null)}
        initialForm={null}
      />
    </div>
  );
}
