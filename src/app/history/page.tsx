'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { BottomNav } from '@/components/BottomNav';
import { AppHeader } from '@/components/AppHeader';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

type SessionUser = { id: string; avatarUrl: string | null };
type RunEntry = {
  score: number;
  totalTimeMs?: number | null;
  gameMode: string;
  survivalRank: string;
  createdAt: string;
};

export default function HistoryPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null | 'loading'>('loading');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [rangeOffset, setRangeOffset] = useState(0); // 0=直近7, 1=その前の7, ...
  const [stats, setStats] = useState<{
    scoreHistory: RunEntry[];
    totalPlayTimeMs?: number;
    modeStats?: { part5: { count: number; avgScore: number }; vocab: { count: number; avgScore: number } };
  } | null>(null);
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

  useEffect(() => {
    if (session === 'loading' || typeof session !== 'object') return;
    fetch('/api/my-stats', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, [session]);

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${totalSec}秒`;
  };

  const formatDurationLong = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return `${h}時間${m}分`;
    if (m > 0) return `${m}分`;
    return `${totalSec}秒`;
  };

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

  // 日付ごと・モード別のプレイ時間（scoreHistory に totalTimeMs がある前提）
  const dailyData = useMemo(() => {
    const list = stats?.scoreHistory ?? [];
    const byDate = new Map<
      string,
      { part5Ms: number; vocabMs: number }
    >();
    for (const r of list) {
      const dateKey = r.createdAt.slice(0, 10);
      if (!byDate.has(dateKey)) byDate.set(dateKey, { part5Ms: 0, vocabMs: 0 });
      const row = byDate.get(dateKey)!;
      const ms = r.totalTimeMs ?? 0;
      if (r.gameMode === 'part5') row.part5Ms += ms;
      else row.vocabMs += ms;
    }
    const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted;
  }, [stats?.scoreHistory]);

  // 日表示用: 直近7日分（日別）。offset で一周期ずらす
  const dayDates = useMemo(() => {
    const dates: string[] = [];
    const endDay = new Date();
    endDay.setDate(endDay.getDate() - rangeOffset * 7);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(endDay);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }, [rangeOffset]);

  const dayData = useMemo(() => {
    const map = new Map<string, { part5Ms: number; vocabMs: number }>();
    for (const d of dayDates) map.set(d, { part5Ms: 0, vocabMs: 0 });
    for (const [dateKey, row] of dailyData) {
      if (map.has(dateKey)) map.set(dateKey, row);
    }
    return dayDates.map((d) => ({
      date: d,
      label: `${parseInt(d.slice(5, 7), 10)}/${parseInt(d.slice(8, 10), 10)}`,
      ...(map.get(d) ?? { part5Ms: 0, vocabMs: 0 }),
    }));
  }, [dailyData, dayDates]);

  // 週表示用: 直近7週分（週合計・月曜始まり）。データがなくても0で7件表示、offsetでずらす
  const getMonday = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  };

  const weekData = useMemo(() => {
    const byWeek = new Map<string, { part5Ms: number; vocabMs: number }>();
    for (const [dateKey, row] of dailyData) {
      const weekKey = getMonday(dateKey);
      if (!byWeek.has(weekKey)) byWeek.set(weekKey, { part5Ms: 0, vocabMs: 0 });
      const w = byWeek.get(weekKey)!;
      w.part5Ms += row.part5Ms;
      w.vocabMs += row.vocabMs;
    }
    const today = new Date().toISOString().slice(0, 10);
    const currentMonday = getMonday(today);
    const mon0 = new Date(currentMonday + 'T12:00:00');
    const endMonday = new Date(mon0);
    endMonday.setDate(mon0.getDate() - 49 * rangeOffset);
    const weekKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const m = new Date(endMonday);
      m.setDate(endMonday.getDate() - 7 * (6 - i));
      weekKeys.push(m.toISOString().slice(0, 10));
    }
    return weekKeys.map((weekKey) => {
      const mon = new Date(weekKey + 'T12:00:00');
      const label = `${mon.getMonth() + 1}/${mon.getDate()}`;
      const row = byWeek.get(weekKey) ?? { part5Ms: 0, vocabMs: 0 };
      return { weekKey, label, ...row };
    });
  }, [dailyData, rangeOffset]);

  // 月表示用: 直近7ヶ月分（月合計）。データがなくても0で7件表示、offsetでずらす
  const addMonths = (ym: string, delta: number) => {
    const [y, m] = ym.split('-').map(Number);
    let month = m - 1 + delta;
    let year = y;
    while (month < 0) {
      month += 12;
      year--;
    }
    while (month > 11) {
      month -= 12;
      year++;
    }
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  };

  const monthData = useMemo(() => {
    const byMonth = new Map<string, { part5Ms: number; vocabMs: number }>();
    for (const [dateKey, row] of dailyData) {
      const monthKey = dateKey.slice(0, 7);
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, { part5Ms: 0, vocabMs: 0 });
      const m = byMonth.get(monthKey)!;
      m.part5Ms += row.part5Ms;
      m.vocabMs += row.vocabMs;
    }
    const thisMonth = new Date().toISOString().slice(0, 7);
    const startMonth = addMonths(thisMonth, -(6 + rangeOffset * 7));
    const monthKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
      monthKeys.push(addMonths(startMonth, i));
    }
    return monthKeys.map((monthKey) => {
      const row = byMonth.get(monthKey) ?? { part5Ms: 0, vocabMs: 0 };
      return {
        monthKey,
        label: monthKey.replace('-', '/'),
        ...row,
      };
    });
  }, [dailyData, rangeOffset]);

  const maxBarMsDay = useMemo(() => {
    const max = Math.max(...dayData.map((w) => w.part5Ms + w.vocabMs), 1);
    return Math.ceil(max / 3600000) * 3600000 || 3600000;
  }, [dayData]);
  const maxBarMsWeek = useMemo(() => {
    const max = Math.max(...weekData.map((w) => w.part5Ms + w.vocabMs), 1);
    return Math.ceil(max / 3600000) * 3600000 || 3600000;
  }, [weekData]);
  const maxBarMsMonth = useMemo(() => {
    const max = Math.max(...monthData.map((w) => w.part5Ms + w.vocabMs), 1);
    return Math.ceil(max / 3600000) * 3600000 || 3600000;
  }, [monthData]);

  const totalPlayTimeMs = stats?.totalPlayTimeMs ?? 0;
  const playDays = dailyData.length;

  if (session === 'loading' || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold)]/70 border-t-transparent" aria-hidden />
          <LoadingWithPercent className="text-zinc-300" />
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
          <h1 className="text-xl font-bold text-white sm:text-2xl tracking-wide">学習記録</h1>

          {/* 日 / 週 / 月 タブ */}
          <div className="mt-4 flex gap-2">
            {(['day', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  period === p
                    ? 'border-gold-subtle bg-[var(--gold)]/20 text-gold'
                    : 'border-gold-subtle bg-zinc-900/80 text-zinc-400 hover:border-[var(--gold)]/50 hover:bg-zinc-800 hover:text-zinc-300'
                }`}
              >
                {p === 'day' ? '日' : p === 'week' ? '週' : '月'}
              </button>
            ))}
          </div>

          {/* 表示範囲をずらす */}
          {stats && (
            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setRangeOffset((o) => o + 1)}
                className="rounded-lg border border-gold-subtle bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-300 hover:border-[var(--gold)]/50 hover:bg-zinc-800"
              >
                前へ
              </button>
              <span className="text-xs text-zinc-500">
                {rangeOffset === 0 ? '直近' : `${rangeOffset + 1}周期前`}
              </span>
              <button
                type="button"
                onClick={() => setRangeOffset((o) => Math.max(0, o - 1))}
                disabled={rangeOffset === 0}
                className="rounded-lg border border-gold-subtle bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-300 hover:border-[var(--gold)]/50 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900"
              >
                次へ
              </button>
            </div>
          )}

          {!stats ? (
            <p className="mt-8 text-center text-zinc-500">読込中...</p>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 space-y-6"
            >
              {/* 日: 直近7日分のグラフ＋日別内訳 */}
              {period === 'day' && (
                <>
                  <section className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
                    <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-gold">勉強時間（日）</h2>
                    <div className="mt-4 flex items-end justify-between gap-1" style={{ minHeight: '120px' }}>
                      {dayData.map((w) => {
                        const total = w.part5Ms + w.vocabMs;
                        const ratio = maxBarMsDay > 0 ? total / maxBarMsDay : 0;
                        return (
                          <div key={w.date} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className="w-full max-w-[32px] rounded-t bg-gold-bar transition-all"
                              style={{ height: `${Math.max(4, ratio * 100)}px` }}
                              title={formatDurationLong(total)}
                            />
                            <span className="text-[10px] text-zinc-500">{w.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">Y: 0h ～ {Math.round(maxBarMsDay / 3600000)}h</p>
                  </section>
                  <section className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
                    <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-gold">日別内訳</h2>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[280px] text-sm">
                        <thead>
                          <tr className="border-b border-gold-subtle text-left text-zinc-500">
                            <th className="py-2 pr-2"></th>
                            {dayData.map((w) => (
                              <th key={w.date} className="py-2 text-center font-normal">
                                {w.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-zinc-700/80">
                            <td className="py-2 pr-2 text-zinc-400">Part 5</td>
                            {dayData.map((w) => (
                              <td key={w.date} className="py-2 text-center text-white">
                                {w.part5Ms ? formatDuration(w.part5Ms) : '0m'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-2 pr-2 text-zinc-400">単語</td>
                            {dayData.map((w) => (
                              <td key={w.date} className="py-2 text-center text-white">
                                {w.vocabMs ? formatDuration(w.vocabMs) : '0m'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {/* 週: 週合計のグラフ＋週別内訳 */}
              {period === 'week' && (
                <>
                  <section className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
                    <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-gold">勉強時間（週）</h2>
                    <div className="mt-4 flex items-end justify-between gap-1" style={{ minHeight: '120px' }}>
                      {weekData.map((w) => {
                        const total = w.part5Ms + w.vocabMs;
                        const ratio = maxBarMsWeek > 0 ? total / maxBarMsWeek : 0;
                        return (
                          <div key={w.weekKey} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className="w-full max-w-[32px] rounded-t bg-gold-bar transition-all"
                              style={{ height: `${Math.max(4, ratio * 100)}px` }}
                              title={formatDurationLong(total)}
                            />
                            <span className="text-[10px] text-zinc-500" title={w.label}>
                              {w.label.length > 10 ? `${w.label.slice(0, 5)}…` : w.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">Y: 0h ～ {Math.round(maxBarMsWeek / 3600000)}h</p>
                  </section>
                  <section className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
                    <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-gold">週別内訳</h2>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[280px] text-sm">
                        <thead>
                          <tr className="border-b border-gold-subtle text-left text-zinc-500">
                            <th className="py-2 pr-2"></th>
                            {weekData.map((w) => (
                              <th key={w.weekKey} className="py-2 text-center font-normal">
                                {w.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-zinc-700">
                            <td className="py-2 pr-2 text-zinc-400">Part 5</td>
                            {weekData.map((w) => (
                              <td key={w.weekKey} className="py-2 text-center text-white">
                                {w.part5Ms ? formatDuration(w.part5Ms) : '0m'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-2 pr-2 text-zinc-400">単語</td>
                            {weekData.map((w) => (
                              <td key={w.weekKey} className="py-2 text-center text-white">
                                {w.vocabMs ? formatDuration(w.vocabMs) : '0m'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {/* 月: 月合計のグラフ＋月別内訳 */}
              {period === 'month' && (
                <>
                  <section className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
                    <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-gold">勉強時間（月）</h2>
                    <div className="mt-4 flex items-end justify-between gap-1" style={{ minHeight: '120px' }}>
                      {monthData.map((w) => {
                        const total = w.part5Ms + w.vocabMs;
                        const ratio = maxBarMsMonth > 0 ? total / maxBarMsMonth : 0;
                        return (
                          <div key={w.monthKey} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className="w-full max-w-[32px] rounded-t bg-gold-bar transition-all"
                              style={{ height: `${Math.max(4, ratio * 100)}px` }}
                              title={formatDurationLong(total)}
                            />
                            <span className="text-[10px] text-zinc-500">{w.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">Y: 0h ～ {Math.round(maxBarMsMonth / 3600000)}h</p>
                  </section>
                  <section className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
                    <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-gold">月別内訳</h2>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[280px] text-sm">
                        <thead>
                          <tr className="border-b border-gold-subtle text-left text-zinc-500">
                            <th className="py-2 pr-2"></th>
                            {monthData.map((w) => (
                              <th key={w.monthKey} className="py-2 text-center font-normal">
                                {w.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-zinc-700">
                            <td className="py-2 pr-2 text-zinc-400">Part 5</td>
                            {monthData.map((w) => (
                              <td key={w.monthKey} className="py-2 text-center text-white">
                                {w.part5Ms ? formatDuration(w.part5Ms) : '0m'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-2 pr-2 text-zinc-400">単語</td>
                            {monthData.map((w) => (
                              <td key={w.monthKey} className="py-2 text-center text-white">
                                {w.vocabMs ? formatDuration(w.vocabMs) : '0m'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {/* 累計 */}
              <section className="rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
                <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-gold">累計</h2>
                <div className="mt-3 space-y-2">
                  <p className="text-lg font-bold text-white">
                    累計勉強時間 <span className="text-gold">{formatDurationLong(totalPlayTimeMs)}</span>
                  </p>
                  <p className="text-lg font-bold text-white">
                    累計プレイ日数 <span className="text-gold">{playDays} DAYS</span>
                  </p>
                </div>
              </section>

            </motion.div>
          )}

          {/* 単語 For You（下スクロールで表示） */}
          <section className="mt-10 border-t border-gold-subtle pt-8">
            <h2 className="text-base font-semibold text-white">単語 For You</h2>
            <p className="mt-0.5 text-xs text-zinc-500">あなただけの単語帳。エクスポート・一括追加。</p>
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
            <div className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
              <h3 className="text-sm font-medium text-zinc-300">エクスポート</h3>
              <button
                type="button"
                onClick={handleExportMyVocab}
                disabled={vocabLoading}
                className="mt-2 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
              >
                CSVでエクスポート
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-gold-subtle bg-zinc-900/80 p-4">
              <h3 className="text-sm font-medium text-zinc-300">一括追加</h3>
              <p className="mt-1 text-xs text-zinc-500">1行1単語で「単語：意味1、意味2」の形式</p>
              <textarea
                value={vocabAddText}
                onChange={(e) => setVocabAddText(e.target.value)}
                placeholder="単語を貼り付け…"
                rows={4}
                className="mt-2 w-full rounded-lg border border-gold-subtle bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-[var(--gold)]/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddMyVocab}
                disabled={vocabLoading || !vocabAddText.trim()}
                className="mt-2 rounded-lg border border-gold-subtle bg-[var(--gold)]/20 px-4 py-2 text-sm font-medium text-gold hover:bg-[var(--gold)]/30 disabled:opacity-50"
              >
                追加
              </button>
            </div>
            <p className="mt-3">
              <Link href="/game?mode=vocab-forYou" className="text-sm text-gold hover:text-gold-bright">単語 For You でプレイ →</Link>
            </p>
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
