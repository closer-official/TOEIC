'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface MyStats {
  baseScore: number;
  estimatedScore: number;
  bracketAvgScore: number | null;
  userAvgScore: number | null;
  sampleSize: number;
  scoreHistory: Array<{
    score: number;
    totalTimeMs: number;
    gameMode: string;
    survivalRank: string;
    createdAt: string;
  }>;
  totalPlayTimeMs?: number;
  modeStats?: {
    part5: { count: number; avgScore: number };
    vocab: { count: number; avgScore: number };
  };
}

interface GameMenuProps {
  onClose?: () => void;
  onQuit?: () => void;
  /** ホーム画面では true。ゲーム中は false でプレイ履歴パネルを表示 */
  variant?: 'home' | 'game';
}

const MAIN_MENU_ITEMS: { label: string; href: string }[] = [
  { label: 'ホーム', href: '/' },
  { label: '学習履歴', href: '/history' },
  { label: 'ランキング', href: '/ranking' },
  { label: '会社概要', href: '/about' },
  { label: 'よくある質問', href: '/faq' },
  { label: '利用規約', href: '/terms' },
  { label: '設定', href: '/settings' },
];

export function GameMenu({ onClose, onQuit, variant = 'home' }: GameMenuProps) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const isGameMenu = variant === 'game' || typeof onQuit === 'function';

  useEffect(() => {
    if (open && isGameMenu) {
      setLoading(true);
      fetch('/api/my-stats')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setStats(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, isGameMenu]);

  const toggle = () => setOpen((o) => !o);
  const close = () => {
    setOpen(false);
    onClose?.();
  };

  const formatDate = (s: string) => {
    const d = new Date(s);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return `${h}時間${m}分`;
    if (m > 0) return `${m}分`;
    return `${totalSec}秒`;
  };

  const modeLabel = (m: string) => (m === 'part5' ? 'Part5' : '単語');
  const rankLabel = (r: string) => r;

  const showNavList = variant === 'home';

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className="touch-target flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 text-zinc-400 active:opacity-80 hover:text-white"
        aria-label="メニューを開く"
      >
        <span className="h-0.5 w-5 rounded bg-current" />
        <span className="h-0.5 w-5 rounded bg-current" />
        <span className="h-0.5 w-5 rounded bg-current" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/70"
              onClick={close}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed left-0 top-0 z-[101] flex h-full w-[min(300px,85vw)] max-w-[300px] flex-col overflow-hidden shadow-2xl"
              style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingLeft: 'env(safe-area-inset-left)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                backgroundColor: '#18181b',
              }}
              data-menu-drawer="nav-list"
            >
              {showNavList ? (
                <>
                  <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-4 py-4">
                    <h2 className="text-lg font-bold text-white">メニュー</h2>
                    <button
                      type="button"
                      onClick={close}
                      className="touch-target min-h-[44px] min-w-[44px] text-zinc-400 active:opacity-80 hover:text-white"
                      aria-label="閉じる"
                    >
                      ✕
                    </button>
                  </div>
                  <nav
                    className="flex-1 overflow-y-auto px-2 py-4"
                    aria-label="メインメニュー"
                    style={{
                      minHeight: '320px',
                      backgroundColor: '#18181b',
                    }}
                  >
                    <p style={{ margin: '0 0 8px 16px', fontSize: '12px', color: '#71717a' }}>メニュー一覧</p>
                    <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {MAIN_MENU_ITEMS.map(({ label, href }) => (
                        <li key={href} style={{ marginBottom: '4px' }}>
                          <a
                            href={href}
                            onClick={(e) => {
                              close();
                            }}
                            style={{
                              display: 'block',
                              padding: '14px 16px',
                              fontSize: '15px',
                              fontWeight: 500,
                              color: '#ffffff',
                              textDecoration: 'none',
                              borderRadius: '8px',
                            }}
                          >
                            {label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </>
              ) : isGameMenu ? (
                <>
                  <div className="flex shrink-0 items-center justify-between border-b border-zinc-700 px-4 py-4">
                    <h2 className="text-lg font-bold text-white">プレイ履歴</h2>
                    <button
                      type="button"
                      onClick={close}
                      className="touch-target min-h-[44px] min-w-[44px] text-zinc-400 active:opacity-80 hover:text-white"
                      aria-label="閉じる"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto overscroll-contain p-4">
                    {loading ? (
                      <p className="py-8 text-center text-zinc-500">読込中...</p>
                    ) : stats ? (
                      <div className="space-y-6">
                        {typeof stats.totalPlayTimeMs === 'number' && (
                          <section>
                            <h3 className="mb-2 text-sm font-medium text-zinc-400">
                              総プレイ時間
                            </h3>
                            <p className="text-xl font-bold text-white">
                              {formatDuration(stats.totalPlayTimeMs)}
                            </p>
                          </section>
                        )}

                        {stats.modeStats && (
                          <section>
                            <h3 className="mb-2 text-sm font-medium text-zinc-400">
                              各モードの成績
                            </h3>
                            <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-400">Part 5</span>
                                <span className="text-white">
                                  平均 {stats.modeStats.part5.avgScore}点 ・ {stats.modeStats.part5.count}回
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-400">単語</span>
                                <span className="text-white">
                                  平均 {stats.modeStats.vocab.avgScore}点 ・ {stats.modeStats.vocab.count}回
                                </span>
                              </div>
                            </div>
                          </section>
                        )}

                        <section>
                          <h3 className="mb-2 text-sm font-medium text-zinc-400">
                            今のあなたの予想スコア
                          </h3>
                          <p className="text-3xl font-bold text-amber-400">
                            {stats.estimatedScore}
                            <span className="ml-1 text-lg font-normal text-zinc-500">
                              点
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            入力スコア（{stats.baseScore}点）と
                            同程度の人の平均ゲームスコアとの比較から算出
                          </p>
                        </section>

                        <section>
                          <h3 className="mb-2 text-sm font-medium text-zinc-400">
                            成長の軌跡（スコア遍歴）
                          </h3>
                          {stats.scoreHistory.length === 0 ? (
                            <p className="py-4 text-sm text-zinc-500">
                              まだプレイ履歴がありません
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {[...stats.scoreHistory]
                                .reverse()
                                .slice(0, 20)
                                .map((r, i) => (
                                  <li
                                    key={`${r.createdAt}-${i}`}
                                    className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm"
                                  >
                                    <span className="text-zinc-400">
                                      {modeLabel(r.gameMode)} {rankLabel(r.survivalRank)}
                                    </span>
                                    <span className="font-bold text-white">
                                      {r.score}
                                    </span>
                                    <span className="text-xs text-zinc-500">
                                      {formatDate(r.createdAt)}
                                    </span>
                                  </li>
                                ))}
                              {stats.scoreHistory.length > 20 && (
                                <li className="text-center text-xs text-zinc-500">
                                  直近20件を表示
                                </li>
                              )}
                            </ul>
                          )}
                        </section>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-zinc-500">
                        ログインするとプレイ履歴が表示されます
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 border-t border-zinc-700 p-4">
                    <Link
                      href="/"
                      onClick={close}
                      className="touch-target flex w-full items-center justify-center rounded-xl border border-zinc-600 py-3 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                    >
                      ホームへ
                    </Link>
                    {onQuit && (
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          onQuit();
                        }}
                        className="touch-target mt-2 w-full rounded-xl py-3 text-sm text-zinc-500 active:opacity-80 hover:text-white"
                      >
                        やめる
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
