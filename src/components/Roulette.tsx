'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { GachaResultItem, GachaResultEquipment } from '@/components/GachaChest';

function rarityResultClass(rarity: string): string {
  switch (rarity) {
    case 'SR':
    case 'レジェンダリー':
      return 'text-amber-200';
    case 'R':
    case 'エピック':
      return 'text-purple-400';
    case 'レア':
      return 'text-amber-400';
    case 'N':
    case 'ノーマル':
    case 'コモン':
      return 'text-zinc-300';
    default:
      return 'text-zinc-500';
  }
}

function ItemImage({ id, size = 256, className = '', base = '/gacha' }: { id: string; size?: number; className?: string; base?: string }) {
  const [imgError, setImgError] = useState(false);
  if (imgError) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-zinc-700/80 text-4xl font-bold text-amber-400 ${className}`}
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }
  return (
    <Image
      src={`${base}/${id}.png`}
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className}`}
      onError={() => setImgError(true)}
    />
  );
}

type Props = {
  onPull: () => Promise<{ item: GachaResultItem | null; equipment: GachaResultEquipment | null } | null>;
  disabled?: boolean;
  label: string;
  cost?: string;
  rateMultiplier?: number;
  obtainedItemIds?: Set<string>;
  obtainedEquipmentIds?: Set<string>;
};

const SEGMENTS = 12;
const SPIN_DURATION_MS = 2800;
const WINE_RED = '#5C2A30';
const WHEEL_BLACK = '#0a0a0a';
const GOLD_ACCENT = '#c9a227';

export function Roulette({ onPull, disabled, label, cost, rateMultiplier = 1, obtainedItemIds = new Set(), obtainedEquipmentIds = new Set() }: Props) {
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'result'>('idle');
  const [result, setResult] = useState<{ item: GachaResultItem | null; equipment: GachaResultEquipment | null } | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleSpin = useCallback(async () => {
    if (disabled || phase !== 'idle') return;
    setPullError(null);
    setPhase('spinning');
    try {
      const data = await onPull();
      if (data) {
        setResult(data);
        setPhase('result');
      } else {
        setPullError('スピンできませんでした');
        setPhase('result');
      }
    } catch (err) {
      setPullError(err instanceof Error ? err.message : 'エラーが発生しました');
      setPhase('result');
    }
  }, [disabled, phase, onPull]);

  const reset = useCallback(() => {
    setPhase('idle');
    setResult(null);
    setPullError(null);
    setShowDetail(false);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-[220px] mx-auto min-h-[180px] flex items-center justify-center [perspective:420px]">
        {(phase === 'idle' || phase === 'spinning') && (
          <button
            type="button"
            onClick={phase === 'idle' ? handleSpin : undefined}
            disabled={(phase === 'idle' && disabled) || phase === 'spinning'}
            className="absolute inset-0 flex h-full w-full items-center justify-center focus:outline-none disabled:cursor-wait rounded-[2rem]"
          >
            {/* 外枠: 真鍮/ゴールドメタル・光沢・3D奥行き */}
            <div
              className="absolute w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] rounded-full"
              style={{
                background: `linear-gradient(145deg, #b8860b 0%, #c9a227 25%, #e2c04a 50%, #c9a227 75%, #8b6914 100%)`,
                boxShadow: `
                  inset 2px 2px 6px rgba(255,255,255,0.4),
                  inset -2px -2px 6px rgba(0,0,0,0.35),
                  0 8px 24px rgba(0,0,0,0.6),
                  0 0 0 3px rgba(139,105,20,0.8)
                `,
                transform: 'rotateX(12deg) rotateZ(0deg)',
              }}
            >
              {/* 内側の溝（黒い縁） */}
              <div className="absolute inset-[6px] rounded-full bg-zinc-900 shadow-inner" />

              {/* ルーレット円盤: ワインレッドと漆黒・斜め3D */}
              <div
                className="absolute inset-[10px] rounded-full overflow-hidden"
                style={{
                  transform: 'rotateX(12deg)',
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(
                      ${Array.from({ length: SEGMENTS * 2 }, (_, i) => {
                        const seg = Math.floor(i / 2);
                        const isGold = i % 2 === 1;
                        const start = (seg * 360) / SEGMENTS + (isGold ? 28 : 0);
                        const end = (seg * 360) / SEGMENTS + (isGold ? 30 : 28);
                        const fill = isGold ? GOLD_ACCENT : (seg % 2 === 0 ? WINE_RED : WHEEL_BLACK);
                        return `${fill} ${start}deg ${end}deg`;
                      }).join(', ')}
                    )`,
                  }}
                  animate={phase === 'spinning' ? { rotate: 360 * 5 } : { rotate: 0 }}
                  transition={phase === 'spinning' ? { duration: SPIN_DURATION_MS / 1000, ease: [0.2, 0.8, 0.3, 1] } : { duration: 0 }}
                />
              </div>

              {/* センターピン: 宝石カット風・立体キャップ */}
              <div
                className="absolute left-1/2 top-1/2 w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-10"
                style={{
                  background: `
                    radial-gradient(ellipse 60% 40% at 30% 25%, rgba(255,255,255,0.7), transparent),
                    radial-gradient(ellipse 50% 50% at 50% 50%, #2a2a2a, #0a0a0a),
                    linear-gradient(145deg, #3d3d3d 0%, #1a1a1a 50%, #0a0a0a 100%)
                  `,
                  boxShadow: `
                    inset 0 2px 4px rgba(255,255,255,0.25),
                    inset 0 -2px 6px rgba(0,0,0,0.8),
                    0 0 0 2px rgba(201,162,39,0.6),
                    0 4px 12px rgba(0,0,0,0.5)
                  `,
                }}
              />
              <div
                className="absolute left-1/2 top-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-10"
                style={{
                  background: 'radial-gradient(circle at 35% 35%, #e2c04a, #8b6914)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 0 8px rgba(201,162,39,0.5)',
                }}
              />

              {/* 針（上向き） */}
              <div
                className="absolute top-[-2px] left-1/2 -translate-x-1/2 w-0 h-0 pointer-events-none z-20"
                style={{
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderTop: '22px solid #dc2626',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                }}
              />
            </div>

            {phase === 'spinning' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[2rem] bg-black/50 backdrop-blur-sm" aria-hidden>
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                <p className="text-xs font-medium text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">スピン中…</p>
              </div>
            )}
          </button>
        )}

        {/* 結果表示 */}
        {phase === 'result' && result && (
          <AnimatePresence mode="wait">
            {showDetail ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col overflow-y-auto p-2 rounded-2xl roulette-glass border border-[var(--gold)]/30"
              >
                {result.item && (
                  <>
                    <p className="text-[10px] text-amber-700/90 mb-1">アイテム</p>
                    <h3 className="border-b border-amber-800/50 pb-1 font-serif text-sm font-bold text-amber-100">{result.item.name}</h3>
                    <p className="text-[10px] text-amber-700/90">{result.item.rarity ?? ''}</p>
                    <div className="my-2 flex justify-center">
                      <ItemImage id={result.item.id} size={100} className="rounded" base="/gacha" />
                    </div>
                    <div className="rounded border border-amber-800/30 bg-amber-950/50 p-2 mb-3">
                      <p className="text-[10px] font-medium text-amber-800/90">効果</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-amber-100/95">{result.item.effect ?? ''}</p>
                    </div>
                  </>
                )}
                {result.equipment && (
                  <>
                    <p className="text-[10px] text-amber-700/90 mb-1">装備</p>
                    <h3 className="border-b border-amber-800/50 pb-1 font-serif text-sm font-bold text-amber-100">
                      {result.equipment.name}
                      {typeof result.equipment.level === 'number' && (
                        <span className="ml-1 text-amber-400 font-normal">Lv.{result.equipment.level}</span>
                      )}
                    </h3>
                    <p className="text-[10px] text-amber-400/90">{result.equipment.slotLabel} / {result.equipment.trait}</p>
                    <div className="rounded border border-amber-800/30 bg-amber-950/50 p-2">
                      <p className="text-[10px] font-medium text-amber-800/90">効果</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-amber-100/95">{result.equipment.effect ?? ''}</p>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowDetail(false)}
                  className="mt-2 rounded border border-amber-700/60 bg-amber-800/40 py-1.5 text-xs text-amber-100"
                >
                  戻る
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="summary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col overflow-y-auto p-2 rounded-2xl roulette-glass"
              >
                <div className="flex flex-1 flex-col items-center gap-2">
                  {result.item && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-zinc-500">アイテム</span>
                      <ItemImage id={result.item.id} size={80} className="rounded-lg" base="/gacha" />
                      <span className="text-center text-xs font-bold text-white">{result.item.name}</span>
                      <span className={`text-[10px] ${rarityResultClass(result.item.rarity ?? '')}`}>{result.item.rarity}</span>
                    </div>
                  )}
                  {result.equipment && (
                    <div className={`flex flex-col items-center gap-0.5 ${result.item ? 'border-t border-zinc-700 pt-2' : ''}`}>
                      <span className="text-[9px] text-zinc-500">装備</span>
                      <span className="text-center text-xs font-bold text-white">
                        {result.equipment.name}
                        {typeof result.equipment.level === 'number' && (
                          <span className="ml-1 font-normal text-amber-400">Lv.{result.equipment.level}</span>
                        )}
                      </span>
                      <span className="text-[10px] text-amber-400/90">{result.equipment.slotLabel} / {result.equipment.trait}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowDetail(true)}
                    className="flex-1 rounded border border-amber-600/50 bg-amber-800/40 py-1.5 text-xs font-medium text-amber-200"
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 rounded border border-amber-600 bg-amber-600 py-1.5 text-xs font-medium text-black hover:bg-amber-500"
                  >
                    もう一度
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {phase === 'result' && pullError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 rounded-2xl roulette-glass">
            <p className="text-center text-sm text-red-400">{pullError}</p>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-500"
            >
              もう一度
            </button>
          </div>
        )}
      </div>

      {phase === 'idle' && (
        <p className="text-center text-base font-semibold">
          <span className="text-zinc-300">{label}</span>
          {cost != null && <span className="ml-2 text-[var(--gold)] drop-shadow-[0_0_10px_rgba(201,162,39,0.5)]">{cost}</span>}
        </p>
      )}
    </div>
  );
}
