'use client';

import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { IconVocab } from '@/components/ModeIcons';

/** 単語→単語（英単語から英単語を選ぶモード）の説明・入口 */
export default function VocabWordPage() {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-zinc-950">
      <AppHeader backHref="/" />
      <main
        className="flex min-h-0 flex-1 flex-col items-center px-4 py-8 content-below-header safe-area-pad"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-8 text-center">
          <span className="shrink-0 text-gold" aria-hidden>
            <IconVocab className="w-14 h-14" />
          </span>
          <h1 className="text-xl font-bold text-white">単語→単語</h1>
          <p className="text-sm text-zinc-400">
            英単語を見て、同じ意味の英単語を選ぶモードです。単語・Part5と同じサバイバル形式で、正解で時間延長・ミスで減算です。
          </p>
          <p className="text-xs text-zinc-500">
            出題データは <code className="rounded bg-zinc-800 px-1">data/vocab-word.json</code>（単語・意味＝英同義語・ダミー1〜5）で、ダミー出題ロジックは単語モードと同じです。
          </p>
          <Link
            href="/game?mode=vocab-word-national"
            className="mt-4 w-full rounded-lg border border-amber-500 bg-amber-500/20 py-3 text-center font-medium text-amber-400 hover:bg-amber-500/30"
          >
            プレイする
          </Link>
          <Link
            href="/"
            className="mt-2 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-6 py-2.5 text-sm font-medium text-gold hover:bg-[var(--gold)]/30"
          >
            ホームへ
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
