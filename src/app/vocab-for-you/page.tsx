'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BottomNav } from '@/components/BottomNav';
import { AppHeader } from '@/components/AppHeader';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

type SessionUser = { id: string; avatarUrl: string | null };

export default function VocabForYouPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null | 'loading'>('loading');
  const [vocabMsg, setVocabMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [vocabAddText, setVocabAddText] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        setSession(null);
        return;
      }
      const avatarUrl =
        (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null;
      setSession({ id: u.id, avatarUrl });
    });
  }, []);

  useEffect(() => {
    if (session === null) {
      router.replace('/login');
      return;
    }
  }, [session, router]);

  const handleExportMyVocab = useCallback(async () => {
    setVocabLoading(true);
    setVocabMsg(null);
    try {
      const res = await fetch('/api/my-vocab/export-csv');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-vocab-for-you.csv';
        a.click();
        URL.revokeObjectURL(url);
        setVocabMsg({ type: 'ok', text: 'CSVをダウンロードしました' });
      } else {
        const j = await res.json().catch(() => ({}));
        setVocabMsg({ type: 'err', text: j.error ?? 'エラー' });
      }
    } catch (e) {
      setVocabMsg({ type: 'err', text: e instanceof Error ? e.message : 'エラー' });
    } finally {
      setVocabLoading(false);
    }
  }, []);

  const handleAddMyVocab = useCallback(async () => {
    if (!vocabAddText.trim()) {
      setVocabMsg({ type: 'err', text: '単語を入力してください' });
      return;
    }
    setVocabLoading(true);
    setVocabMsg(null);
    try {
      const res = await fetch('/api/my-vocab/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: vocabAddText.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setVocabMsg({ type: 'ok', text: j.message ?? `${j.count} 単語を追加しました` });
        setVocabAddText('');
      } else {
        setVocabMsg({ type: 'err', text: j.error ?? '追加に失敗しました' });
      }
    } catch (e) {
      setVocabMsg({ type: 'err', text: e instanceof Error ? e.message : 'エラー' });
    } finally {
      setVocabLoading(false);
    }
  }, [vocabAddText]);

  if (session === 'loading' || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)]/70 border-t-transparent" aria-hidden />
          <LoadingWithPercent className="text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader />

      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold tracking-wide text-white sm:text-2xl">単語 For You 管理</h1>
          <p className="mt-1 text-sm text-zinc-400">
            あなただけの単語帳。CSVでエクスポートしたり、一括で追加できます。
          </p>

          {vocabMsg && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                vocabMsg.type === 'ok'
                  ? 'border-emerald-800/50 bg-emerald-900/30 text-emerald-300'
                  : 'border-red-800/50 bg-red-900/30 text-red-300'
              }`}
            >
              {vocabMsg.text}
            </div>
          )}

          <section className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
            <h2 className="text-sm font-medium text-zinc-300">エクスポート</h2>
            <p className="mt-1 text-xs text-zinc-500">登録単語をCSVでダウンロードします。</p>
            <button
              type="button"
              onClick={handleExportMyVocab}
              disabled={vocabLoading}
              className="mt-3 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
            >
              CSVでエクスポート
            </button>
          </section>

          <section className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
            <h2 className="text-sm font-medium text-zinc-300">一括追加</h2>
            <p className="mt-1 text-xs text-zinc-500">1行1単語で「単語：意味1、意味2」の形式で追加</p>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-gold-subtle bg-zinc-800/80 p-2 text-xs text-zinc-400">
              {`Delegate：委譲する、代表者
Assign：割り当てる、配属する`}
            </pre>
            <textarea
              value={vocabAddText}
              onChange={(e) => setVocabAddText(e.target.value)}
              placeholder="上記形式で単語を貼り付け…"
              rows={5}
              className="mt-2 w-full rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--gold)]/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddMyVocab}
              disabled={vocabLoading || !vocabAddText.trim()}
              className="mt-2 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
            >
              単語 For You に追加
            </button>
          </section>

          <section className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
            <h2 className="text-sm font-medium text-zinc-300">プレイ</h2>
            <p className="mt-1 text-xs text-zinc-500">For Youモードでプレイ（タップでゲーム開始）</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/game?mode=vocab-forYou"
                className="rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-3 text-sm font-medium text-gold hover:bg-[var(--gold)]/30"
              >
                単語 For You でプレイ
              </Link>
              <Link
                href="/game?mode=part5-forYou"
                className="rounded-lg border border-gold-subtle bg-zinc-800/80 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Part 5 For You でプレイ
              </Link>
            </div>
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
