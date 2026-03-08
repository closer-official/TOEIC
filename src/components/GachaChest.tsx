'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GachaItem } from '@/lib/gacha-items';

export type GachaResultItem = { id: string; name: string; rarity?: string; effect: string };
export type GachaResultEquipment = { id: string; name: string; slotLabel: string; trait: string; effect: string; level?: number };

const GACHA_IMAGE_BASE = '/gacha';

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

type Props = {
  onPull: () => Promise<{ item: GachaResultItem | null; equipment: GachaResultEquipment | null } | null>;
  disabled?: boolean;
  label: string;
  cost?: string;
  rateMultiplier?: number;
  chestType?: 'wood' | 'gold';
  obtainedItemIds?: Set<string>;
  obtainedEquipmentIds?: Set<string>;
};

export function GachaChest({ onPull, disabled, label, cost, rateMultiplier = 1, chestType = 'wood', obtainedItemIds = new Set(), obtainedEquipmentIds = new Set() }: Props) {
  const [phase, setPhase] = useState<'idle' | 'shaking' | 'video' | 'result'>('idle');
  const [result, setResult] = useState<{ item: GachaResultItem | null; equipment: GachaResultEquipment | null } | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoEnded = useCallback(() => {
    setPhase('result');
    setShowDetail(false);
  }, []);

  useEffect(() => {
    if (phase === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  const handleClick = async () => {
    if (disabled || phase !== 'idle') return;
    setPullError(null);
    setPhase('shaking');
    // 「引いています」表示中は動画を再生しない。読み込み完了後に video フェーズで1回だけ再生する
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.currentTime = 0;
    try {
      const data = await onPull();
      if (data) {
        setResult(data);
        setPhase('video');
      } else {
        setPullError('引けませんでした');
        setPhase('result');
      }
    } catch (err) {
      setPullError(err instanceof Error ? err.message : 'エラーが発生しました');
      setPhase('result');
    }
  };

  const reset = () => {
    setPhase('idle');
    setResult(null);
    setPullError(null);
    setShowDetail(false);
  };

  const videoSrc = chestType === 'gold' ? '/gold_takarabako.mp4' : '/takarabako.mp4';

  /** 枠のサイズ。枠いっぱいに動画を表示 */
  const frameClass = 'aspect-[4/3] w-full min-h-[160px] overflow-hidden rounded-xl bg-black';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* メイン枠: 動画（常に表示）or 結果表示 */}
      <div className={`relative ${frameClass}`}>
        {/* 動画: idle/shaking/video で表示。押されたら再生 */}
        {(phase === 'idle' || phase === 'shaking' || phase === 'video') && (
          <button
            type="button"
            onClick={phase === 'idle' ? handleClick : undefined}
            disabled={(phase === 'idle' && disabled) || phase === 'shaking'}
            className="absolute inset-0 flex h-full w-full items-center justify-center focus:outline-none disabled:cursor-wait"
            style={{ padding: 0, border: 'none', background: 'transparent' }}
          >
            <video
              ref={videoRef}
              src={videoSrc}
              playsInline
              muted={false}
              preload="auto"
              onEnded={handleVideoEnded}
              className={`h-full w-full object-cover ${phase === 'shaking' ? 'invisible' : ''}`}
            />
            {phase === 'shaking' && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50"
                onClick={(e) => e.preventDefault()}
                aria-hidden
              >
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                <p className="text-xs text-amber-400">引いています…</p>
              </div>
            )}
          </button>
        )}

        {/* result: 装備のみ表示（アイテム廃止済み） or 詳細（?で切り替え） */}
        {phase === 'result' && result && (
          <AnimatePresence mode="wait">
            {showDetail ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col overflow-y-auto p-2"
                style={{
                  background: 'linear-gradient(180deg, #1c1917 0%, #292524 50%, #1c1917 100%)',
                  border: '1px solid #57534e',
                }}
              >
                {result.item && (
                  <>
                    <p className="text-[10px] text-amber-700/90 mb-1">アイテム</p>
                    <h3 className="border-b border-amber-800/50 pb-1 font-serif text-sm font-bold text-amber-100">{result.item.name}</h3>
                    <p className="text-[10px] text-amber-700/90">{result.item.rarity ?? ''}</p>
                    <div className="my-2 flex h-16 w-full items-center justify-center rounded bg-zinc-700/80">
                      <span className="text-sm font-medium text-white">{result.item.name}</span>
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
                className="absolute inset-0 flex flex-col overflow-y-auto p-2"
              >
                <div className="flex flex-1 flex-col items-center gap-2">
                  {result.item && (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-zinc-500">アイテム</span>
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

        {/* result + error */}
        {phase === 'result' && pullError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2">
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
          {cost != null && <span className="ml-2 text-gold drop-shadow-sm">{cost}</span>}
        </p>
      )}
    </div>
  );
}
