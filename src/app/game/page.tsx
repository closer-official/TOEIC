'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { db, type Word, type WordProgress } from '@/lib/db';
import { onCorrect, onMiss, getIntervalForStage } from '@/lib/ebbinghaus';
import { seedIfEmpty } from '@/lib/seed';
import { incrementTodayPlay, canPlayFreeToday } from '@/lib/dailyLimit';
import { createClient } from '@/lib/supabase/client';
import { PaywallModal } from '@/components/PaywallModal';
import { ExplanationWithVocab } from '@/components/ExplanationWithVocab';
import type { GameQuestion, GameMode } from '@/types/game';

const VOCAB_TIMEOUT_MS = 5000;
const GRAMMAR_TIMEOUT_MS = 10000;

export default function GamePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950"><p className="text-white">Loading...</p></div>}>
      <GameContent />
    </Suspense>
  );
}

function toGameQuestion(w: Word): GameQuestion {
  return {
    id: w.id,
    question: w.question,
    options: w.options,
    correctIndex: w.correctIndex,
    type: w.type,
  };
}

function supabaseToGameQuestion(q: {
  id: string;
  question: string;
  options: string[] | [string, string, string, string];
  correct_index: number;
  explanation?: string | null;
  category?: string;
  vocab_map?: Record<string, string[] | [string, string?, string?]>;
}): GameQuestion {
  const opts = Array.isArray(q.options) && q.options.length >= 4
    ? [q.options[0], q.options[1], q.options[2], q.options[3]] as [string, string, string, string]
    : (['', '', '', ''] as [string, string, string, string]);
  const vm = q.vocab_map ?? {};
  const vocabMap: Record<string, string[]> = {};
  Object.entries(vm).forEach(([k, v]) => {
    vocabMap[k] = Array.isArray(v) ? v.filter(Boolean) as string[] : [];
  });
  return {
    id: q.id,
    question: q.question,
    options: opts,
    correctIndex: q.correct_index,
    type: 'grammar',
    explanation: q.explanation ?? null,
    category: q.category,
    vocab_map: Object.keys(vocabMap).length ? vocabMap : undefined,
  };
}

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: GameMode = (searchParams.get('mode') as GameMode) ?? 'national';

  const [queue, setQueue] = useState<GameQuestion[]>([]);
  const [isSupabaseQueue, setIsSupabaseQueue] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [combo, setCombo] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);
  const [registeredWords, setRegisteredWords] = useState<Set<string>>(new Set());
  const questionStartMsRef = useRef(Date.now());
  const totalTimeMsRef = useRef(0);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    questionStartMsRef.current = Date.now();
  }, [currentIndex]);

  const current = queue[currentIndex];

  const loadQueue = useCallback(async () => {
    if (mode === 'vocab') {
      try {
        const res = await fetch('/api/vocabulary?userId=anon');
        if (res.ok) {
          const list = await res.json();
          if (list.length > 0) {
            const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
            const asQuestions: GameQuestion[] = list.map((v: { word: string; meanings: string[] }, i: number) => {
              const opts = [
                v.meanings[0] ?? '',
                v.meanings[1] ?? v.meanings[0] ?? '',
                v.meanings[2] ?? v.meanings[0] ?? '',
                v.meanings[0] ?? '',
              ].filter(Boolean).slice(0, 4) as [string, string, string, string];
              const correct = opts[0];
              const shuffled = shuffle(opts);
              const correctIndex = shuffled.indexOf(correct);
              return {
                id: `vocab-${v.word}-${i}`,
                question: v.word,
                options: shuffled.length === 4 ? shuffled : (opts as [string, string, string, string]),
                correctIndex: correctIndex >= 0 ? correctIndex : 0,
                type: 'vocabulary',
              };
            });
            setQueue(asQuestions);
            setLoading(false);
            return;
          }
        }
      } catch {
        // fallback
      }
      setQueue([]);
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({ mode: mode === 'forYou' ? 'forYou' : 'national', limit: '20' });
      if (userIdRef.current) params.set('userId', userIdRef.current);
      const res = await fetch(`/api/questions?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setIsSupabaseQueue(true);
          setQueue(data.map(supabaseToGameQuestion));
          setLoading(false);
          if (data.length > 0) incrementTodayPlay();
          return;
        }
      }
    } catch {
      // fallback to Dexie
    }
    setIsSupabaseQueue(false);

    await seedIfEmpty();
    const now = Date.now();
    const all = await db.words.toArray();
    const withProgress = await Promise.all(
      all.map(async (w) => {
        const p = await db.wordProgress.get(w.id);
        return { ...w, progress: p };
      })
    );
    const due = withProgress.filter(
      (w) => !w.progress || w.progress.nextReviewAt <= now
    );
    const shuffled = [...due].sort(() => Math.random() - 0.5);
    const nextQueue = (shuffled.length > 0 ? shuffled : withProgress.slice(0, 5)).map(toGameQuestion);
    setQueue(nextQueue);
    setLoading(false);
    if (nextQueue.length > 0) incrementTodayPlay();
  }, [mode]);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session?.user?.id) userIdRef.current = data.session.user.id;
      });
  }, []);

  useEffect(() => {
    if (!canPlayFreeToday()) {
      setShowPaywall(true);
      setLoading(false);
      return;
    }
    loadQueue();
  }, [loadQueue]);

  const recordAnswerLocal = useCallback(
    async (word: GameQuestion & { progress?: WordProgress }, correct: boolean) => {
      const w = word as Word & { progress?: WordProgress };
      if (!('correctIndex' in w)) return;
      const now = Date.now();
      const progress = w.progress;
      const stage = (progress?.stage ?? 1) as 1 | 2 | 3 | 4 | 5;
      const strength = progress?.memoryStrength ?? 0.5;
      if (correct) {
        const { stage: newStage, nextIntervalMs, newStrength } = onCorrect(
          stage,
          getIntervalForStage(stage),
          strength,
          true
        );
        await db.wordProgress.put({
          wordId: w.id,
          stage: newStage,
          lastReviewedAt: now,
          nextReviewAt: now + nextIntervalMs,
          memoryStrength: newStrength,
          correctCount: (progress?.correctCount ?? 0) + 1,
        });
      } else {
        const { stage: newStage, nextIntervalMs, newStrength } = onMiss();
        await db.wordProgress.put({
          wordId: w.id,
          stage: newStage,
          lastReviewedAt: now,
          nextReviewAt: now + nextIntervalMs,
          memoryStrength: newStrength,
          correctCount: progress?.correctCount ?? 0,
        });
      }
    },
    []
  );

  const handleAnswer = useCallback(
    async (word: GameQuestion, choiceIndex: number) => {
      if (answered) return;
      setAnswered(true);
      const correct = choiceIndex === word.correctIndex;
      setResult(correct ? 'correct' : 'wrong');
      const responseTime = Date.now() - questionStartMsRef.current;

      if (!isSupabaseQueue) {
        const w = await db.words.get(word.id);
        if (w) {
          const p = await db.wordProgress.get(word.id);
          await recordAnswerLocal({ ...w, progress: p } as GameQuestion & { progress?: WordProgress }, correct);
        }
      }

      if (userIdRef.current && mode !== 'vocab') {
        try {
          await fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userIdRef.current,
              questionId: word.id,
              correct,
              responseTimeMs: responseTime,
              category: word.category ?? 'その他',
            }),
          });
        } catch {
          // ignore
        }
      }

      totalTimeMsRef.current += responseTime;
      if (correct) setCombo((c) => c + 1);
      else setCombo(0);
      setShowExplanation(true);
    },
    [answered, queue, mode, recordAnswerLocal]
  );

  const handleTimeout = useCallback(
    async (word: GameQuestion) => {
      if (answered) return;
      setAnswered(true);
      setResult('wrong');
      const responseTime = Date.now() - questionStartMsRef.current;
      if (userIdRef.current && mode !== 'vocab') {
        try {
          await fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userIdRef.current,
              questionId: word.id,
              correct: false,
              responseTimeMs: responseTime,
              category: word.category ?? 'その他',
            }),
          });
        } catch {
          // ignore
        }
      }
      totalTimeMsRef.current += responseTime;
      setCombo(0);
      setShowExplanation(true);
    },
    [answered, mode]
  );

  const goNext = useCallback(() => {
    setShowExplanation(false);
    setResult(null);
    if (currentIndex + 1 >= queue.length) {
      if (userIdRef.current && mode === 'national') {
        const score = queue.filter((_, i) => i <= currentIndex).length;
        fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userIdRef.current,
            score,
            totalTimeMs: totalTimeMsRef.current,
          }),
        }).catch(() => {});
      }
      router.push(mode === 'national' ? '/ranking' : '/dashboard');
    } else {
      setCurrentIndex((i) => i + 1);
      setAnswered(false);
    }
  }, [currentIndex, queue.length, mode, router]);

  const handleRegisterWord = useCallback(
    async (word: string, meanings: string[]) => {
      setRegisteredWords((s) => new Set(s).add(word.toLowerCase()));
      if (!userIdRef.current) return;
      try {
        await fetch('/api/vocabulary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userIdRef.current,
            word: word.toLowerCase(),
            meanings,
          }),
        });
      } catch {
        // ignore
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (showPaywall) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <p className="text-white">本日の無料プレイは終了しました</p>
        </div>
        <PaywallModal open={showPaywall} onClose={() => router.push('/')} />
      </>
    );
  }

  if (!current) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950">
        <p className="text-white">
          {mode === 'vocab' ? '登録単語がありません。問題で単語をタップして追加しましょう。' : '出題する問題がありません'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="rounded-lg bg-amber-500 px-6 py-2 font-bold text-black"
        >
          ホームへ
        </button>
      </div>
    );
  }

  const timeoutMs = current.type === 'grammar' ? GRAMMAR_TIMEOUT_MS : VOCAB_TIMEOUT_MS;

  return (
    <div className="relative flex min-h-screen flex-col bg-zinc-950">
      <header className="flex items-center justify-between p-4">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← やめる
        </button>
        <div className="flex items-center gap-4">
          <AnimatePresence mode="wait">
            {combo >= 2 && (
              <motion.span
                key={combo}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.1, opacity: 0 }}
                className="text-lg font-bold text-amber-400"
              >
                {combo} COMBO
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-zinc-500">
            {currentIndex + 1} / {queue.length}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <StreamCube
          word={current}
          durationMs={timeoutMs}
          onTimeout={() => handleTimeout(current)}
          result={result}
          answered={answered}
        />

        <AnimatePresence>
          {showExplanation && (
            <>
              <ExplanationWithVocab
                explanation={current.explanation ?? null}
                vocabMap={current.vocab_map ?? {}}
                correctOption={current.options[current.correctIndex]}
                onRegisterWord={handleRegisterWord}
                registeredWords={registeredWords}
              />
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={goNext}
                className="w-full max-w-lg rounded-xl bg-amber-500 py-3 font-bold text-black"
              >
                {currentIndex + 1 >= queue.length ? '結果へ' : '次へ'}
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {!showExplanation && (
          <div className="grid w-full max-w-lg grid-cols-2 gap-3">
            {current.options.map((opt, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleAnswer(current, i)}
                disabled={answered}
                className={`rounded-xl border-2 px-4 py-4 text-left font-medium transition-colors ${
                  result === 'correct' && i === current.correctIndex
                    ? 'border-green-500 bg-green-500/20 text-green-400'
                    : result === 'wrong' && i === current.correctIndex
                      ? 'border-green-500 bg-green-500/20 text-green-400'
                      : result === 'wrong' && i !== current.correctIndex && answered
                        ? 'border-red-500/50 bg-red-500/10 text-red-400'
                        : 'border-zinc-600 bg-zinc-800 text-white hover:border-amber-500/50'
                }`}
              >
                {opt}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StreamCube({
  word,
  durationMs,
  onTimeout,
  result,
  answered,
}: {
  word: GameQuestion;
  durationMs: number;
  onTimeout: () => void;
  result: 'correct' | 'wrong' | null;
  answered: boolean;
}) {
  useEffect(() => {
    if (answered) return;
    const t = setTimeout(() => onTimeout(), durationMs);
    return () => clearTimeout(t);
  }, [word.id, durationMs, onTimeout, answered]);

  return (
    <div className="relative w-full max-w-lg">
      <motion.div
        animate={
          result
            ? { scale: 1.05, opacity: result === 'correct' ? 1 : 0.7 }
            : { scale: 1, opacity: 1 }
        }
        className="rounded-2xl border-2 border-amber-500/50 bg-zinc-900 px-8 py-10 shadow-xl"
      >
        <p className="text-center text-2xl font-bold text-white">{word.question}</p>
        <p className="mt-2 text-center text-sm text-zinc-500">
          {word.type === 'vocabulary' ? '5秒' : '10秒'}で回答
        </p>
      </motion.div>
      <div className="absolute -bottom-2 left-0 right-0 h-1 overflow-hidden rounded-full bg-zinc-700">
        <motion.div
          className="h-full bg-amber-500"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: durationMs / 1000, ease: 'linear' }}
        />
      </div>
    </div>
  );
}

