'use client';

import Link from 'next/link';
import { useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import {
  getCurrentEvent,
  getCurrentWeekRange,
  WEEKLY_EVENTS,
} from '@/lib/weekly-events';

/** プレイ画面が実装済みのイベントID */
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
  const isPreview = searchParams.get('preview') === '1' || searchParams.get('dev') === '1';

  // 表向きは Coming Soon。?preview=1 または ?dev=1 で開発者用に実画面を表示
  if (!isPreview) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <AppHeader backHref="/" />
        <main
          className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6"
          style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <h1 className="text-xl font-bold text-white">イベント・大会</h1>
          <p className="mt-2 text-sm text-zinc-500">週替わりイベントと日曜大会をまとめてご案内します。</p>

          <section className="mt-6 rounded-xl border border-gold-subtle bg-zinc-900/80 p-6">
            <h2 className="text-base font-semibold text-white">週替わりイベント</h2>
            <p className="mt-2 text-sm text-zinc-400">すごろく・タワーなど週替わりで特別報酬がもらえるイベントは準備中です。</p>
            <div className="mt-4 rounded-lg border border-zinc-600 bg-zinc-800/50 p-4 text-center">
              <p className="text-lg font-semibold text-gold">Coming Soon</p>
              <p className="mt-1 text-xs text-zinc-500">しばらくお待ちください。</p>
            </div>
          </section>

          <section className="mt-6 rounded-xl border border-amber-600/50 bg-amber-950/30 p-6">
            <h2 className="text-base font-semibold text-amber-200">大会</h2>
            <p className="mt-2 text-sm text-zinc-400">毎週日曜 12:00〜23:00 JST に Part5・単語 各1回の合算スコアでランキングを競います。</p>
            <Link
              href="/tournament"
              className="mt-4 block rounded-lg border border-amber-500/50 bg-amber-900/30 py-3 text-center font-medium text-amber-200 hover:bg-amber-800/50"
            >
              大会ページへ →
            </Link>
          </section>

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

  const current = useMemo(() => getCurrentEvent(), []);
  const { start, end } = useMemo(() => getCurrentWeekRange(), []);
  const currentHasContent = EVENTS_WITH_CONTENT.includes(current.id);
  const playableEvents = useMemo(() => WEEKLY_EVENTS.filter((e) => EVENTS_WITH_CONTENT.includes(e.id)), []);

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <AppHeader backHref="/" />
      <main
        className="min-h-0 flex-1 overflow-y-auto px-4 content-below-header safe-area-pad sm:px-6"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mb-2 rounded bg-amber-950/50 px-2 py-1 text-center text-xs text-amber-400">
          開発者プレビュー（?preview=1）
        </div>
        <h1 className="text-xl font-bold text-white">イベント・大会</h1>
        <p className="mt-2 text-sm text-zinc-500">週替わりイベントと日曜大会をまとめてご案内します。</p>

        <section className="mt-4 rounded-xl border border-amber-600/50 bg-amber-950/30 p-4">
          <h2 className="text-base font-semibold text-amber-200">大会</h2>
          <p className="mt-1 text-sm text-zinc-400">毎週日曜 12:00〜23:00 JST に Part5・単語 各1回の合算スコアでランキングを競います。</p>
          <Link
            href="/tournament"
            className="mt-3 block rounded-lg border border-amber-500/50 bg-amber-900/30 py-2.5 text-center text-sm font-medium text-amber-200 hover:bg-amber-800/50"
          >
            大会ページへ →
          </Link>
        </section>

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
                href={`/event/${current.id}?preview=1`}
                className="block rounded-lg border border-gold-subtle bg-[var(--gold)]/20 py-3 text-center font-medium text-gold hover:bg-[var(--gold)]/30"
              >
                プレイする →
              </Link>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-gold-subtle bg-zinc-800/80 p-4 text-center">
              <p className="text-sm text-zinc-500">今週のイベントは準備中です。</p>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-amber-600/50 bg-amber-950/30 p-4">
          <h2 className="text-base font-semibold text-amber-200">実装済みイベント一覧</h2>
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
    <Suspense
      fallback={
        <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
          <AppHeader backHref="/" />
          <main className="flex min-h-0 flex-1 items-center justify-center px-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </main>
          <BottomNav />
        </div>
      }
    >
      <EventPageContent />
    </Suspense>
  );
}
