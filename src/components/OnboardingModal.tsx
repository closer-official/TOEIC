'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export interface OnboardingForm {
  username: string;
  current_toeic_score: string;
  target_toeic_score: string;
  next_exam_date: string;
  closer_id: string;
  referrer_id: string;
}

export type OnboardingInitial = Partial<OnboardingForm>;

interface OnboardingModalProps {
  open: boolean;
  onSkip: () => void;
  onSubmit: (form: OnboardingForm) => Promise<void>;
  loading?: boolean;
  saveError?: string | null;
  onDismissError?: () => void;
  /** 編集時は既存値を渡す。あると「プロフィール編集」として表示し、スキップを「キャンセル」に */
  initialForm?: OnboardingInitial | null;
}

export function OnboardingModal({ open, onSkip, onSubmit, loading = false, saveError, onDismissError, initialForm }: OnboardingModalProps) {
  const [username, setUsername] = useState('');
  const [currentToeic, setCurrentToeic] = useState('');
  const [targetToeic, setTargetToeic] = useState('');
  const [nextExam, setNextExam] = useState('');
  const [closerId, setCloserId] = useState('');
  const [referrerId, setReferrerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = initialForm != null;

  useEffect(() => {
    if (open && initialForm) {
      setUsername(initialForm.username ?? '');
      setCurrentToeic(initialForm.current_toeic_score ?? '');
      setTargetToeic(initialForm.target_toeic_score ?? '');
      setNextExam(initialForm.next_exam_date ?? '');
      setCloserId(initialForm.closer_id ?? '');
      setReferrerId(initialForm.referrer_id ?? '');
    }
    if (open && !initialForm) {
      setUsername('');
      setCurrentToeic('');
      setTargetToeic('');
      setNextExam('');
      setCloserId('');
      setReferrerId('');
    }
  }, [open, initialForm]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        username: username.trim(),
        current_toeic_score: currentToeic.trim(),
        target_toeic_score: targetToeic.trim(),
        next_exam_date: nextExam.trim(),
        closer_id: closerId.trim(),
        referrer_id: referrerId.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80 p-4 safe-area-pad"
      style={{ overscrollBehavior: 'contain' }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl"
      >
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >
        <h2 className="text-lg font-bold text-white">{isEdit ? 'プロフィール編集' : 'プロフィール（任意）'}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {isEdit ? 'ランキング表示名・TOEIC・目標・受験日・紹介者コードをいつでも変更できます。' : 'ランキングの表示名や目標を設定できます。スキップもできます。'}
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="onboard-username" className="block text-sm font-medium text-zinc-400">
              ユーザー名（ランキングに表示）
            </label>
            <input
              id="onboard-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例: 受験生A"
              className="mt-1 w-full rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-base text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="onboard-current" className="block text-sm font-medium text-zinc-400">
              現在のTOEICスコア
            </label>
            <input
              id="onboard-current"
              type="number"
              min={0}
              max={990}
              value={currentToeic}
              onChange={(e) => setCurrentToeic(e.target.value)}
              placeholder="例: 650"
              className="mt-1 w-full rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-base text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="onboard-target" className="block text-sm font-medium text-zinc-400">
              目標スコア
            </label>
            <input
              id="onboard-target"
              type="number"
              min={0}
              max={990}
              value={targetToeic}
              onChange={(e) => setTargetToeic(e.target.value)}
              placeholder="例: 800"
              className="mt-1 w-full rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-base text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="onboard-exam" className="block text-sm font-medium text-zinc-400">
              次に受験する日
            </label>
            <input
              id="onboard-exam"
              type="date"
              value={nextExam}
              onChange={(e) => setNextExam(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-base text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="onboard-closer-id" className="block text-sm font-medium text-zinc-400">
              Closer ID
            </label>
            <input
              id="onboard-closer-id"
              type="text"
              value={closerId}
              onChange={(e) => setCloserId(e.target.value)}
              placeholder="任意"
              className="mt-1 w-full rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-base text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="onboard-referrer-id" className="block text-sm font-medium text-zinc-400">
              紹介者ID
            </label>
            <input
              id="onboard-referrer-id"
              type="text"
              value={referrerId}
              onChange={(e) => setReferrerId(e.target.value)}
              placeholder="任意"
              className="mt-1 w-full rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-base text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {saveError && (
          <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-3 text-sm text-red-300">
            <p className="font-medium">保存できませんでした</p>
            <p className="mt-1 text-red-200/90">{saveError}</p>
            <div className="mt-3 border-t border-red-500/30 pt-3">
              <p className="mb-1 font-medium text-amber-200">▼ テーブルを作成する方法（SQL）</p>
              <p className="mb-1 text-xs text-zinc-400">1. supabase.com/dashboard → プロジェクトを開く → SQL Editor → New query</p>
              <p className="mb-2 text-xs text-zinc-400">2. 下のSQLをすべてコピーして貼り付け → Run</p>
              <pre className="max-h-48 overflow-auto rounded bg-zinc-900 p-2 text-xs leading-snug text-zinc-300" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
{`CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  current_toeic_score INTEGER,
  target_toeic_score INTEGER,
  next_exam_date DATE,
  closer_id TEXT,
  referrer_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`}
              </pre>
            </div>
            {onDismissError && (
              <button type="button" onClick={onDismissError} className="mt-2 underline">
                閉じる
              </button>
            )}
          </div>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:mt-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || submitting}
            className="touch-target w-full rounded-xl bg-amber-500 py-3 font-bold text-black transition active:opacity-90 hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存'}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={loading || submitting}
            className="touch-target w-full rounded-xl border border-zinc-600 py-3 font-medium text-zinc-400 transition active:opacity-90 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
          >
            {isEdit ? 'キャンセル' : 'スキップ'}
          </button>
        </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
