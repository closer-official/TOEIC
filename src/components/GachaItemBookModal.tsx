'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GACHA_ITEMS } from '@/lib/gacha-items';

/**
 * アイテム画像の配置場所:
 * public/gacha/{item_id}.png
 * 例: public/gacha/coin.png, public/gacha/phoenix_feather.png
 * ファイル名は gacha-items.ts の id と一致させること。
 */
const GACHA_IMAGE_BASE = '/gacha';

type GachaItemDisplay = { id: string; name: string; rarity: string; effect: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** クリックされたアイテムID（初期表示） */
  initialItemId: string | null;
  /** 獲得済みアイテムのID一覧 */
  obtainedIds: Set<string>;
};

export function GachaItemBookModal({
  open,
  onClose,
  initialItemId,
  obtainedIds,
}: Props) {
  const items: GachaItemDisplay[] = GACHA_ITEMS.map((it) => ({
    id: it.id,
    name: it.name,
    rarity: it.rarity,
    effect: it.effect,
  }));

  const initialIndex = initialItemId
    ? items.findIndex((it) => it.id === initialItemId)
    : 0;
  const [pageIndex, setPageIndex] = useState(Math.max(0, initialIndex));

  useEffect(() => {
    if (open && initialItemId) {
      const idx = GACHA_ITEMS.findIndex((it) => it.id === initialItemId);
      setPageIndex(Math.max(0, idx));
    }
  }, [open, initialItemId]);

  const item = items[pageIndex];
  const isObtained = item ? obtainedIds.has(item.id) : false;

  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPageIndex((i) => Math.min(items.length - 1, i + 1));

  return (
    <AnimatePresence>
      {open && (
      <motion.div
        key="gacha-item-book-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-xl shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, #1c1917 0%, #292524 15%, #44403c 50%, #292524 85%, #1c1917 100%)',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 0 40px rgba(120,53,15,0.3)',
            border: '2px solid #57534e',
          }}
        >
          {/* 古書のページ風テクスチャオーバーレイ */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative p-6">
            {/* ページめくりナビ */}
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={goPrev}
                disabled={pageIndex <= 0}
                className="rounded-lg border border-amber-800/60 bg-amber-950/50 px-3 py-2 text-sm font-medium text-amber-200 disabled:opacity-30"
              >
                ← 前
              </button>
              <span className="text-xs text-amber-900/80">
                {pageIndex + 1} / {items.length}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={pageIndex >= items.length - 1}
                className="rounded-lg border border-amber-800/60 bg-amber-950/50 px-3 py-2 text-sm font-medium text-amber-200 disabled:opacity-30"
              >
                次 →
              </button>
            </div>

            {item && (
              <div className="min-h-[280px] rounded-lg border border-amber-900/40 bg-amber-950/30 p-4">
                {isObtained ? (
                  <>
                    <h3 className="border-b border-amber-800/50 pb-2 font-serif text-lg font-bold text-amber-100">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-xs text-amber-700/90">{item.rarity}</p>
                    <div className="mt-4 flex justify-center">
                      <div className="relative h-32 w-32 overflow-hidden rounded-lg border-2 border-amber-800/50 bg-amber-900/30">
                        <img
                          src={`${GACHA_IMAGE_BASE}/${item.id}.png`}
                          alt={item.name}
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }}
                        />
                        <div
                          className="hidden h-full w-full items-center justify-center bg-amber-900/20 text-4xl"
                          aria-hidden
                        >
                          ?
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded border border-amber-800/30 bg-amber-950/50 p-3">
                      <p className="text-xs font-medium text-amber-800/90">効果</p>
                      <p className="mt-1 text-sm leading-relaxed text-amber-100/95">
                        {item.effect}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="relative flex min-h-[280px] flex-col items-center justify-center">
                    <div
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: 'linear-gradient(180deg, rgba(68,64,60,0.6) 0%, rgba(28,25,23,0.8) 100%)',
                        backdropFilter: 'blur(4px)',
                      }}
                    />
                    <div className="relative z-10 text-6xl text-amber-900/60">?</div>
                    <p className="relative z-10 mt-2 text-sm text-amber-800/70">
                      未出現：このアイテムを獲得すると図鑑に登録されます
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg border border-amber-700/60 bg-amber-800/40 py-2.5 text-sm font-medium text-amber-100"
            >
              閉じる
            </button>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
