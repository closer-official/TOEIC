'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

interface RunRow {
  id: string;
  user_id: string;
  score: number;
  username?: string | null;
  avatar_url?: string | null;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export default function RankingPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const err = (() => {
      try {
        const raw = sessionStorage.getItem('runs_insert_error');
        if (raw) {
          sessionStorage.removeItem('runs_insert_error');
          const o = JSON.parse(raw) as { message?: string };
          if (o?.message === 'not_logged_in') return 'ランキングに記録するにはログインしてください。';
          return o?.message ? `記録に失敗しました: ${o.message}` : null;
        }
      } catch {
        // ignore
      }
      return null;
    })();
    if (err) setRunsError(err);
  }, []);

  useEffect(() => {
    const load = async () => {
      setRunsError(null);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      setIsLoggedIn(!!user);
      setMyUserId(user?.id ?? null);
      const avatarUrl =
        (user?.user_metadata?.avatar_url as string) ??
        (user?.user_metadata?.picture as string) ??
        null;
      setMyAvatarUrl(avatarUrl && avatarUrl.trim() ? avatarUrl.trim() : null);

      try {
        const res = await fetch('/api/ranking/combined?limit=50', { credentials: 'include' });
        const data = await res.json().catch(() => ({ runs: [] }));
        setRuns(Array.isArray(data.runs) ? data.runs : []);
      } catch {
        setRuns([]);
      } finally {
        setLoading(false);
      }
    };
    setLoading(true);
    load();
  }, []);

  useEffect(() => {
    fetch('/api/announcements', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setAnnouncements(json?.items ?? []))
      .catch(() => setAnnouncements([]));
  }, []);

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader />
      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6 sm:py-8"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-white sm:text-2xl">全国ランキング</h1>
        <p className="mt-1 text-sm text-zinc-500">単語＋Part 5 の合計得点（60秒モード）</p>

        {runsError && (
          <div className="mt-3 rounded-lg border border-gold-subtle bg-[var(--gold)]/10 px-3 py-2 text-sm text-gold-bright">
            {runsError}
          </div>
        )}
        {!isLoggedIn && (
          <p className="mt-2 rounded-lg border border-gold-subtle bg-[var(--gold)]/10 px-3 py-2 text-sm text-gold-bright">
            ゲストのままプレイしたスコアはランキングに反映されません。ログインすると記録されます。
          </p>
        )}

        {loading ? (
          <LoadingWithPercent className="mt-8 block text-zinc-500" />
        ) : runs.length === 0 ? (
          <p className="mt-8 text-zinc-500">まだ記録がありません</p>
        ) : (
          <ul className="mt-6 space-y-2">
            {runs.map((run, i) => {
              const isMe = myUserId != null && run.user_id === myUserId;
              return (
              <motion.li
                key={run.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  isMe ? 'border-[var(--gold)]/60 bg-[var(--gold)]/15' : 'border-gold-subtle bg-zinc-900/80'
                }`}
              >
                <span className="shrink-0 text-lg font-bold text-gold">#{i + 1}</span>
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-700">
                  {(isMe && myAvatarUrl) || run.avatar_url?.trim() ? (
                    <img
                      src={(isMe && myAvatarUrl) ? myAvatarUrl : run.avatar_url!}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-medium text-zinc-400">
                      {(run.username?.trim() || '?').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate text-white" title={run.username ?? '匿名'}>
                  {run.username?.trim() || '匿名'}
                </span>
                <span className="shrink-0 font-medium text-white">{run.score} pt</span>
                {isMe && <span className="shrink-0 rounded bg-[var(--gold)]/20 px-1.5 py-0.5 text-xs text-gold">自分</span>}
              </motion.li>
              );
            })}
          </ul>
        )}

        {/* 掲示板（運営からの連絡） */}
        <section className="mt-10">
          <h2 className="text-base font-semibold text-white">掲示板</h2>
          <p className="mt-0.5 text-xs text-zinc-500">運営からのお知らせ</p>
          {announcements.length === 0 ? (
            <p className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 px-4 py-6 text-center text-sm text-zinc-500">
              お知らせはありません
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {announcements.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-gold-subtle bg-zinc-900/80 px-4 py-3"
                >
                  <p className="font-medium text-white">{a.title}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-400">{a.body}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {new Date(a.createdAt).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-8 text-center">
          <Link href="/" className="text-sm text-gold hover:text-gold-bright">
            ← ホームへ
          </Link>
        </p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
