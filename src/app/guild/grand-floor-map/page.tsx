'use client';

import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';

/** THE GRAND FLOOR 廃止に伴い、ギルド画面へ誘導 */
export default function GrandFloorMapPage() {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-zinc-950">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 content-below-header safe-area-pad">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-6 text-center max-w-sm">
          <p className="text-lg font-semibold text-zinc-300">THE GRAND FLOOR は廃止しました</p>
          <p className="mt-2 text-sm text-zinc-500">
            ギルドランキングは「ギルド実力」（今週のメンバーベスト合計）で集計しています。
          </p>
          <Link
            href="/guild"
            className="mt-4 inline-block rounded-lg bg-amber-600/90 px-6 py-2.5 text-sm font-medium text-black hover:bg-amber-500"
          >
            ギルド画面へ
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
