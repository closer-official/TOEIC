'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { OnboardingModal, type OnboardingForm } from '@/components/OnboardingModal';
import { GameMenu } from '@/components/GameMenu';

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<{ id: string } | null | 'loading'>('loading');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInitialForm, setEditInitialForm] = useState<Parameters<typeof OnboardingModal>[0]['initialForm']>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [myStats, setMyStats] = useState<{
    estimatedScore: number;
    baseScore: number;
    scoreHistory: Array<{ score: number; gameMode: string; survivalRank: string; createdAt: string }>;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session?.user ? { id: data.session.user.id } : null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s?.user ? { id: s.user.id } : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) {
      router.replace('/login');
      return;
    }
  }, [session, router]);

  useEffect(() => {
    if (session === 'loading' || session === null || typeof session !== 'object') return;
    fetch('/api/my-stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setMyStats({
            estimatedScore: data.estimatedScore,
            baseScore: data.baseScore,
            scoreHistory: data.scoreHistory ?? [],
          });
        }
      })
      .catch(() => {});
  }, [session]);

  // ログイン済みでプロフィールがなければオンボーディング表示
  useEffect(() => {
    if (session === 'loading' || session === null || typeof session !== 'object') return;
    const load = async () => {
      try {
        const { data } = await createClient()
          .from('profiles')
          .select('user_id')
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
    setShowEditModal(false);
  };

  if (session === 'loading' || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-start overflow-y-auto bg-zinc-950 px-4 py-6 safe-area-pad sm:px-6">
      <header className="fixed left-0 right-0 top-0 z-40 flex shrink-0 items-center justify-between border-b border-zinc-800/50 bg-zinc-950/90 px-4 py-3 backdrop-blur sm:px-6">
        <GameMenu />
        <button
          type="button"
          onClick={() => router.refresh()}
          className="touch-target text-lg font-bold text-white active:opacity-80 hover:text-amber-400"
        >
          瞬
        </button>
        <div className="w-11" />
      </header>
      <div className="mt-16" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:mt-12 sm:gap-4"
      >
        <p className="text-center text-sm text-zinc-500">Part 5（文法・品詞）</p>
        <Link
          href="/game?mode=part5-national"
          className="touch-target flex items-center justify-center rounded-2xl bg-amber-500 py-4 text-base font-bold text-black transition active:opacity-90 hover:bg-amber-400 sm:py-5 sm:text-lg"
        >
          Part 5 全国モード
        </Link>
        <Link
          href="/game?mode=part5-forYou"
          className="touch-target flex items-center justify-center rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 py-4 text-base font-bold text-amber-400 transition active:opacity-90 hover:border-amber-500/20 sm:py-5 sm:text-lg"
        >
          Part 5 For You
        </Link>

        <p className="mt-2 text-center text-sm text-zinc-500 sm:mt-4">単語</p>
        <Link
          href="/game?mode=vocab-national"
          className="touch-target flex items-center justify-center rounded-2xl bg-amber-500/80 py-4 text-base font-bold text-black transition active:opacity-90 hover:bg-amber-500/90 sm:py-5 sm:text-lg"
        >
          単語 全国モード
        </Link>
        <Link
          href="/game?mode=vocab-forYou"
          className="touch-target flex items-center justify-center rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 py-4 text-base font-bold text-amber-400 transition active:opacity-90 hover:border-amber-500/20 sm:py-5 sm:text-lg"
        >
          単語 For You
        </Link>

      </motion.div>

      {myStats && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6 w-full max-w-sm sm:mt-8"
        >
          <h3 className="mb-3 text-center text-sm font-medium text-zinc-400">
            成長の軌跡
          </h3>
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900/50 p-4">
            <div className="mb-4 flex items-baseline justify-center gap-2">
              <span className="text-2xl font-bold text-amber-400">
                {myStats.estimatedScore}
              </span>
              <span className="text-zinc-500">点（予想）</span>
              <span className="text-xs text-zinc-600">
                入力: {myStats.baseScore}点
              </span>
            </div>
            <p className="mb-3 text-xs text-zinc-500">
              スコア遍歴（直近10件）
            </p>
            {myStats.scoreHistory.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500">
                まだプレイ履歴がありません
              </p>
            ) : (
              <ul className="space-y-2">
                {[...myStats.scoreHistory]
                  .reverse()
                  .slice(0, 10)
                  .map((r, i) => (
                    <li
                      key={`${r.createdAt}-${i}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-zinc-400">
                        {r.gameMode === 'part5' ? 'Part5' : '単語'}{' '}
                        {r.survivalRank}
                      </span>
                      <span className="font-bold text-white">{r.score}</span>
                      <span className="text-xs text-zinc-600">
                        {new Date(r.createdAt).toLocaleDateString('ja-JP', {
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </motion.section>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 flex flex-col items-center gap-3 text-center sm:mt-8 sm:gap-2"
      >
        <button
          type="button"
          onClick={async () => {
            const uid = typeof session === 'object' && session && 'id' in session ? session.id : null;
            if (!uid) return;
            const { data } = await createClient()
              .from('profiles')
              .select('username, current_toeic_score, target_toeic_score, next_exam_date, closer_id, referrer_id')
              .eq('user_id', uid)
              .maybeSingle();
            setEditInitialForm(
              data
                ? {
                    username: data.username ?? '',
                    current_toeic_score: data.current_toeic_score != null ? String(data.current_toeic_score) : '',
                    target_toeic_score: data.target_toeic_score != null ? String(data.target_toeic_score) : '',
                    next_exam_date: data.next_exam_date ?? '',
                    closer_id: data.closer_id ?? '',
                    referrer_id: data.referrer_id ?? '',
                  }
                : {}
            );
            setProfileSaveError(null);
            setShowEditModal(true);
          }}
          className="touch-target min-h-[44px] px-4 text-sm text-amber-500/80 active:opacity-80 hover:text-amber-400"
        >
          プロフィール編集
        </button>
        <Link
          href="/ranking"
          className="touch-target min-h-[44px] flex items-center justify-center px-4 text-sm text-amber-500/80 active:opacity-80 hover:text-amber-400"
        >
          全国ランキング →
        </Link>
        <button
          type="button"
          onClick={async () => {
            await createClient().auth.signOut();
            router.replace('/login');
          }}
          className="touch-target min-h-[44px] px-4 text-xs text-zinc-500 active:opacity-80 hover:text-zinc-400"
        >
          ログアウト
        </button>
      </motion.div>

      <OnboardingModal
        open={showOnboarding || showEditModal}
        onSkip={() => {
          if (showEditModal) setShowEditModal(false);
          else handleOnboardingSkip();
        }}
        onSubmit={handleOnboardingSubmit}
        loading={onboardingLoading}
        saveError={profileSaveError}
        onDismissError={() => setProfileSaveError(null)}
        initialForm={showEditModal ? editInitialForm : null}
      />
    </div>
  );
}
