'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AppHeader } from '@/components/AppHeader';
import { BottomNav } from '@/components/BottomNav';
import { GACHA_EQUIPMENT } from '@/lib/equipment-items';
import { isTournamentWindowNow, type TournamentRules } from '@/lib/tournament';

type MyRuns = {
  part5: { score: number; totalTimeMs: number } | null;
  vocab: { score: number; totalTimeMs: number } | null;
  total: number;
};

type RankingEntry = {
  rank: number;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  part5_score: number;
  vocab_score: number;
  total_score: number;
};

/** 今日（JST）の 12:00 JST の Date。12:00 JST = その日の 03:00 UTC */
function getToday1200JST(): Date {
  const now = Date.now();
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), 3, 0, 0, 0));
}

/** 次回の大会開始日時（初回は今日 12:00 JST、以降は毎週日曜 12:00 JST）を返す。12:00 JST = 03:00 UTC */
function getNextTournamentAt(): Date {
  const now = Date.now();
  const today1200 = getToday1200JST();
  if (now < today1200.getTime()) return today1200;
  const d = new Date(now);
  const utcDay = d.getUTCDay();
  const nextSun0300 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (7 - utcDay) % 7, 3, 0, 0, 0));
  if (now < nextSun0300.getTime()) return nextSun0300;
  nextSun0300.setUTCDate(nextSun0300.getUTCDate() + 7);
  return nextSun0300;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

type TournamentCurrent = {
  id: string | null;
  startDate: string;
  prizeLabel: string;
  prizeYen: number | null;
  rulesEnabled: boolean;
  rules: TournamentRules | null;
};

export default function TournamentPage() {
  const [rem, setRem] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [nextAt, setNextAt] = useState<Date | null>(null);
  const [current, setCurrent] = useState<TournamentCurrent | null>(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [myRuns, setMyRuns] = useState<MyRuns | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [rankingStartDate, setRankingStartDate] = useState<string | null>(null);

  const fetchMyRuns = useCallback(() => {
    fetch('/api/tournament/my-runs', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) setMyRuns({ part5: data.part5 ?? null, vocab: data.vocab ?? null, total: data.total ?? 0 });
      })
      .catch(() => {});
  }, []);

  const fetchRanking = useCallback(() => {
    fetch('/api/tournament/ranking', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ranking) {
          setRanking(data.ranking);
          setRankingStartDate(data.startDate ?? null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const tick = () => {
      const next = getNextTournamentAt();
      setNextAt(next);
      const now = Date.now();
      const openAt = next.getTime();
      if (now >= openAt) {
        setRem({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const diff = openAt - now;
      setRem({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch('/api/tournament/current', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCurrent({
            id: data.id ?? null,
            startDate: data.startDate ?? '',
            prizeLabel: data.prizeLabel ?? '',
            prizeYen: data.prizeYen ?? null,
            rulesEnabled: data.rulesEnabled ?? false,
            rules: data.rules ?? null,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const check = () => setWindowOpen(isTournamentWindowNow());
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (windowOpen) {
      fetchMyRuns();
      fetchRanking();
    }
  }, [windowOpen, fetchMyRuns, fetchRanking]);

  const part5Played = myRuns?.part5 != null;
  const vocabPlayed = myRuns?.vocab != null;
  const buttonDisabled = !windowOpen;
  const equipmentByName = Object.fromEntries(GACHA_EQUIPMENT.map((e) => [e.id, e.name]));

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-zinc-950">
      <AppHeader />
      <main
        className="flex flex-1 flex-col items-center px-4 py-6 content-below-header safe-area-pad"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* 今週の大会内容（管理者設定） */}
        {current && (
          <section className="mb-8 w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 text-left">
            <h2 className="font-semibold text-amber-400">今週の大会内容</h2>
            <p className="mt-1 text-xs text-zinc-500">日曜 12:00〜23:00 JST に Part5・単語 各1回の合算スコアで競います。</p>
            {current.prizeLabel ? (
              <div className="mt-3">
                <span className="text-xs text-zinc-500">賞品: </span>
                <span className="font-medium text-white">{current.prizeLabel}</span>
                {typeof current.prizeYen === 'number' && current.prizeYen > 0 && (
                  <span className="ml-1 text-sm text-zinc-400">（{current.prizeYen.toLocaleString()}円相当）</span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">賞品は未設定です。</p>
            )}
            <div className="mt-3 border-t border-zinc-700 pt-3">
              <p className="text-xs text-zinc-500">ルール</p>
              {current.rulesEnabled && current.rules ? (
                <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-zinc-300">
                  <li>指定された装備・レベルでのみ使用可</li>
                  <li>個人成長: {current.rules.personalGrowth !== false ? '有効' : '無効'}</li>
                  <li>ギルド成長: {current.rules.guildGrowth !== false ? '有効' : '無効'}</li>
                  {current.rules.equipment && (
                    <li className="mt-2 list-none">
                      <span className="text-xs text-zinc-500">使用可装備: </span>
                      <span className="text-xs text-zinc-400">
                        {Object.entries(current.rules.equipment)
                          .filter(([, v]) => v?.allowed)
                          .map(([id]) => equipmentByName[id] ?? id)
                          .join(' / ') || 'なし'}
                      </span>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-zinc-400">ルールOFF — 自分の装備・成長をフル使用できます。</p>
              )}
            </div>
          </section>
        )}

        <div className="flex flex-1 flex-col items-center gap-6 text-center">
          {windowOpen ? (
            <>
              <p className="text-sm font-medium text-amber-400">開催中：Part5・単語 各1回プレイできます</p>
              <div className="flex w-full max-w-sm flex-col gap-3">
                <div className="flex items-center justify-between rounded-xl border border-zinc-600 bg-zinc-800/80 px-4 py-3">
                  <span className="font-medium text-white">Part 5</span>
                  {part5Played ? (
                    <span className="text-sm text-zinc-400">済 スコア {myRuns!.part5!.score.toLocaleString()}</span>
                  ) : (
                    <Link
                      href="/game?mode=part5-tournament"
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-amber-400"
                    >
                      プレイする
                    </Link>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-zinc-600 bg-zinc-800/80 px-4 py-3">
                  <span className="font-medium text-white">単語</span>
                  {vocabPlayed ? (
                    <span className="text-sm text-zinc-400">済 スコア {myRuns!.vocab!.score.toLocaleString()}</span>
                  ) : (
                    <Link
                      href="/game?mode=vocab-tournament"
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-amber-400"
                    >
                      プレイする
                    </Link>
                  )}
                </div>
              </div>
              {myRuns && (part5Played || vocabPlayed) && (
                <p className="text-sm text-zinc-400">合計スコア: {myRuns.total.toLocaleString()}</p>
              )}
            </>
          ) : (
            rem != null &&
            nextAt && (
              <>
                <p className="text-sm text-zinc-400">次回大会まで</p>
                <div className="flex gap-3 font-mono text-3xl font-bold text-amber-400 sm:gap-4 sm:text-4xl">
                  <span className="rounded-lg bg-zinc-800 px-3 py-2">{pad(rem.days)}</span>
                  <span className="flex items-center text-zinc-500">日</span>
                  <span className="rounded-lg bg-zinc-800 px-3 py-2">{pad(rem.hours)}</span>
                  <span className="flex items-center text-zinc-500">:</span>
                  <span className="rounded-lg bg-zinc-800 px-3 py-2">{pad(rem.minutes)}</span>
                  <span className="flex items-center text-zinc-500">:</span>
                  <span className="rounded-lg bg-zinc-800 px-3 py-2">{pad(rem.seconds)}</span>
                </div>
                <p className="text-xs text-zinc-500">毎週日曜 12:00〜23:00 JST（初回は今日 12:00〜）</p>
                <p className="text-xs text-zinc-500">
                  次回: {nextAt.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                </p>
                <button
                  type="button"
                  disabled={buttonDisabled}
                  className="mt-4 rounded-xl border border-zinc-600 bg-zinc-800 px-8 py-3 font-medium text-zinc-500 disabled:cursor-not-allowed"
                >
                  参加する（開催までお待ちください）
                </button>
              </>
            )
          )}
        </div>

        {/* 今週の大会ランキング */}
        {(ranking.length > 0 || windowOpen) && (
          <section className="mt-6 w-full max-w-md">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-amber-400">今週の大会ランキング</h2>
              {windowOpen && (
                <button
                  type="button"
                  onClick={() => { fetchRanking(); fetchMyRuns(); }}
                  className="text-xs text-zinc-500 hover:text-amber-400"
                >
                  更新
                </button>
              )}
            </div>
            {ranking.length === 0 ? (
              <p className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 text-center text-sm text-zinc-500">まだエントリーがありません</p>
            ) : (
              <ul className="rounded-xl border border-zinc-700 bg-zinc-900/50 overflow-hidden">
                {ranking.map((e) => (
                  <li
                    key={e.user_id}
                    className="flex items-center gap-3 border-b border-zinc-700/80 px-3 py-2 last:border-b-0"
                  >
                    <span className="w-6 shrink-0 text-sm font-medium text-zinc-400">{e.rank}</span>
                    {e.avatar_url ? (
                      <Image src={e.avatar_url} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="h-7 w-7 shrink-0 rounded-full bg-zinc-600" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-white">{e.username ?? '名無し'}</span>
                    <span className="shrink-0 text-sm font-medium text-amber-400">{e.total_score.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
            {rankingStartDate && <p className="mt-1 text-xs text-zinc-500">週: {rankingStartDate}</p>}
          </section>
        )}
        <Link href="/" className="mt-4 text-sm text-amber-500 hover:text-amber-400">
          ホームへ
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}
