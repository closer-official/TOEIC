'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      if (data.session?.user) router.replace('/');
    });
  }, [router]);
  const [closerId, setCloserId] = useState('');
  const [referrerId, setReferrerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  const handleLogin = async (guestOnly = false) => {
    if (!isSupabaseConfigured()) {
      setError('Supabase の設定がありません。Vercel の環境変数（NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY）を確認してください。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const metadata: Record<string, string> = {};
      if (!guestOnly) {
        if (closerId.trim()) metadata.closer_id = closerId.trim();
        if (referrerId.trim()) metadata.referrer_id = referrerId.trim();
      }
      const { error: err } = await supabase.auth.signInAnonymously({
        options: { data: Object.keys(metadata).length ? metadata : undefined },
      });
      if (err) throw err;
      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

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
        className="mt-12 w-full max-w-sm space-y-4"
      >
        <div>
          <label htmlFor="closer-id" className="block text-sm font-medium text-zinc-400">
            Closer ID
          </label>
          <input
            id="closer-id"
            type="text"
            value={closerId}
            onChange={(e) => setCloserId(e.target.value)}
            placeholder="Closer IDを入力"
            className="mt-1 w-full rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Closer IDをお持ちでない方は{' '}
            <a
              href="https://sell.closer-official.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-500 underline hover:text-amber-400"
            >
              https://sell.closer-official.com/
            </a>
            へ
          </p>
        </div>

        <div>
          <label htmlFor="referrer-id" className="block text-sm font-medium text-zinc-400">
            紹介者ID
          </label>
          <input
            id="referrer-id"
            type="text"
            value={referrerId}
            onChange={(e) => setReferrerId(e.target.value)}
            placeholder="紹介者IDを入力（任意）"
            className="mt-1 w-full rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={() => handleLogin(false)}
          disabled={loading}
          className="mt-4 w-full rounded-2xl bg-amber-500 py-4 text-lg font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? 'ログイン中...' : 'プレイする'}
        </button>

        <div className="relative flex items-center py-4">
          <div className="flex-1 border-t border-zinc-600" />
          <span className="px-4 text-xs text-zinc-500">または</span>
          <div className="flex-1 border-t border-zinc-600" />
        </div>

        <button
          type="button"
          onClick={() => handleLogin(true)}
          disabled={loading}
          className="w-full rounded-2xl border-2 border-zinc-600 py-4 text-lg font-medium text-white transition hover:border-amber-500/50 hover:bg-zinc-800 disabled:opacity-50"
        >
          ゲストでプレイ
        </button>
      </motion.div>
    </div>
  );
}
