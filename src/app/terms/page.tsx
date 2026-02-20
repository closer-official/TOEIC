'use client';

import Link from 'next/link';
import { GameMenu } from '@/components/GameMenu';

export default function TermsPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-zinc-950">
      <header className="fixed left-0 right-0 top-0 z-40 flex shrink-0 items-center justify-between border-b border-zinc-800/50 bg-zinc-950/90 px-4 py-3 backdrop-blur sm:px-6">
        <GameMenu variant="home" />
        <Link href="/" className="touch-target text-lg font-bold text-white active:opacity-80 hover:text-amber-400">
          瞬
        </Link>
        <div className="w-11" />
      </header>
      <main className="px-4 pt-16 pb-8 safe-area-pad sm:px-6">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-white sm:text-2xl">利用規約</h1>
          <p className="mt-6 text-zinc-400">準備中です。</p>
          <p className="mt-8 text-center">
            <Link href="/" className="text-sm text-amber-500/80 hover:text-amber-400">
              ← ホームへ
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
