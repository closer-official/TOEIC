'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<{ id: string } | null | 'loading'>('loading');

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

  if (session === 'loading' || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-black tracking-tight text-white"
      >
        Closer
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-2 text-zinc-500"
      >
        暗記をeスポーツ化する
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-12 flex w-full max-w-sm flex-col gap-4"
      >
        <p className="text-center text-sm text-zinc-500">Part 5（文法・品詞）</p>
        <Link
          href="/game?mode=part5-national"
          className="flex items-center justify-center rounded-2xl bg-amber-500 py-5 text-lg font-bold text-black transition hover:bg-amber-400"
        >
          Part 5 全国モード
        </Link>
        <Link
          href="/game?mode=part5-forYou"
          className="flex items-center justify-center rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 py-5 text-lg font-bold text-amber-400 transition hover:border-amber-500/20"
        >
          Part 5 For You
        </Link>

        <p className="mt-4 text-center text-sm text-zinc-500">単語</p>
        <Link
          href="/game?mode=vocab-national"
          className="flex items-center justify-center rounded-2xl bg-amber-500/80 py-5 text-lg font-bold text-black transition hover:bg-amber-500/90"
        >
          単語 全国モード
        </Link>
        <Link
          href="/game?mode=vocab-forYou"
          className="flex items-center justify-center rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 py-5 text-lg font-bold text-amber-400 transition hover:border-amber-500/20"
        >
          単語 For You
        </Link>

        <Link
          href="/dashboard"
          className="mt-4 flex items-center justify-center rounded-xl border border-zinc-700 py-3 text-sm text-zinc-400 transition hover:text-white"
        >
          記憶の分布図
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex flex-col items-center gap-2 text-center"
      >
        <Link
          href="/ranking"
          className="text-sm text-amber-500/80 hover:text-amber-400"
        >
          全国ランキング →
        </Link>
        <button
          type="button"
          onClick={async () => {
            await createClient().auth.signOut();
            router.replace('/login');
          }}
          className="text-xs text-zinc-500 hover:text-zinc-400"
        >
          ログアウト
        </button>
      </motion.div>
    </div>
  );
}
