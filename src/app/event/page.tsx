'use client';

import Link from 'next/link';
import { useMemo, Suspense } from 'react';
import { useSearchParams, redirect } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import {
  getCurrentEvent,
  getCurrentWeekIndex,
  getCurrentWeekRange,
  WEEKLY_EVENTS,
} from '@/lib/weekly-events';

/** プレイ画面が実装済みのイベントID（リリース時はここからスタート） */
const EVENTS_WITH_CONTENT: string[] = ['sugoroku', 'tower', 'ichiban'];

function formatDate(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day}`;
}

function formatWeekRange(start: Date, end: Date): string {
  return `${formatDate(start)} 〜 ${formatDate(end)}`;
}

function EventPageContent() {
  const searchParams = useSearchParams();
  const preview = searchParams.get('preview') === '1' || searchParams.get('dev') === '1';
  const current = useMemo(() => getCurrentEvent(), []);
  const weekIndex = useMemo(() => getCurrentWeekIndex(), []);
  const { start, end } = useMemo(() => getCurrentWeekRange(), []);
  const currentHasContent = EVENTS_WITH_CONTENT.includes(current.id);
  const playableEvents = useMemo(() => WEEKLY_EVENTS.filter((e) => EVENTS_WITH_CONTENT.includes(e.id)), []);

  // 一般ユーザー: 一覧ではなく今週のイベントに直接飛ばす。開発者（?preview=1）は一覧を表示
  if (!preview && currentHasContent) {
    redirect(`/event/${current.id}`);
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader backHref="/" />
      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <h1 className="text-xl font-bold text-white">イベント・大会</h1>
        <p className="mt-2 text-sm text-zinc-500">週替わりイベントです。その週のイベントだけが表示・プレイ可能です。</p>

        {/* 今週の週替わりイベント（その週だけ表示・プレイ可能） */}
        <section className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-white">今週のイベント</h2>
            <span className="rounded bg-[var(--gold)]/20 px-2 py-0.5 text-xs font-medium text-gold">
              {formatWeekRange(start, end)}
            </span>
          </div>
          <p className="mt-2 text-lg font-bold text-gold">{current.name}</p>
          <p className="mt-1 text-sm text-zinc-400">{current.shortDesc}</p>
          <p className="mt-3 text-sm text-zinc-500">{current.description}</p>
          <p className="mt-2 text-xs text-gold">💎 {current.gemFeatures}</p>

          {currentHasContent ? (
            <div className="mt-4">
              <Link
                href={`/event/${current.id}`}
                className="block rounded-lg border border-gold-subtle bg-[var(--gold)]/20 py-3 text-center font-medium text-gold hover:bg-[var(--gold)]/30"
              >
                プレイする →
              </Link>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-gold-subtle bg-zinc-800/80 p-4 text-center">
              <p className="text-sm text-zinc-500">今週のイベントは準備中です。</p>
              <p className="mt-2 text-xs text-zinc-400">次週以降のイベントをお楽しみに。</p>
            </div>
          )}
        </section>

        {/* 開発者用のみ: 他週のイベント一覧（一般ユーザーには表示しない） */}
        {preview && (
          <section className="mt-6 rounded-xl border border-amber-600/50 bg-amber-950/30 p-4">
            <h2 className="text-base font-semibold text-amber-200">他週のイベント一覧（開発者用）</h2>
            <p className="mt-1 text-xs text-zinc-400">通常はその週のイベントのみ表示されます。?preview=1 で確認用に一覧を表示しています。</p>
            <ul className="mt-3 space-y-2">
              {playableEvents.map((ev) => {
                const isCurrent = ev.id === current.id;
                return (
                  <li
                    key={ev.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                      isCurrent ? 'border-[var(--gold)]/50 bg-[var(--gold)]/10' : 'border-amber-700/50 bg-amber-950/20'
                    }`}
                  >
                    <span className="text-sm font-medium text-white">{ev.name}</span>
                    <div className="flex items-center gap-2">
                      {isCurrent && (
                        <span className="rounded bg-[var(--gold)]/20 px-2 py-0.5 text-xs font-medium text-gold">
                          今週
                        </span>
                      )}
                      <Link
                        href={`/event/${ev.id}?preview=1`}
                        className="rounded border border-amber-500/50 bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-800/50"
                      >
                        プレビュー
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="mt-8 text-center">
          <Link href="/" className="text-sm text-gold hover:text-gold-bright">
            ← ホームへ
          </Link>
        </p>
      </main>
      <BottomNav />
    </div>
  );
}

export default function EventPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <AppHeader backHref="/" />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6" style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 rounded bg-zinc-800" />
            <div className="h-4 w-64 rounded bg-zinc-800" />
            <div className="mt-6 h-32 rounded-xl bg-zinc-800/80" />
          </div>
        </main>
        <BottomNav />
      </div>
    }>
      <EventPageContent />
    </Suspense>
  );
}
