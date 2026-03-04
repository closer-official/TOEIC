'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StaminaModalProps {
  open: boolean;
  onClose: () => void;
  /** 次回復までの秒数（表示用、あれば） */
  nextRecoverySeconds?: number;
}

const CHIPS_PER_STAMINA = 4;

export function StaminaModal({ open, onClose, nextRecoverySeconds }: StaminaModalProps) {
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);

  const handleRecover = async () => {
    setRecoverError(null);
    setRecoverLoading(true);
    try {
      const res = await fetch('/api/stamina', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'recover', amount: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRecoverError(data.error ?? '回復に失敗しました');
        return;
      }
      window.dispatchEvent(new Event('stamina-updated'));
      window.dispatchEvent(new Event('gems-updated'));
    } catch {
      setRecoverError('通信エラーが発生しました');
    } finally {
      setRecoverLoading(false);
    }
  };

  if (!open) return null;

  const formatTime = (sec: number) => {
    if (sec >= 3600) return `${Math.floor(sec / 3600)}時間 ${Math.floor((sec % 3600) / 60)}分 ${sec % 60}秒`;
    if (sec >= 60) return `${Math.floor(sec / 60)}分 ${sec % 60}秒`;
    return `${sec}秒`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-zinc-900 p-8 shadow-2xl"
        >
          <h2 className="text-center text-2xl font-bold text-white">
            スタミナが足りません
          </h2>
          <p className="mt-4 text-center text-zinc-400">
            1プレイで5スタミナを消費します。スタミナは24時間で自動回復します。
          </p>
          {nextRecoverySeconds != null && nextRecoverySeconds > 0 && (
            <p className="mt-2 text-center text-sm text-amber-400">
              次回復まで約 {formatTime(nextRecoverySeconds)}
            </p>
          )}
          <p className="mt-2 text-center text-xs text-zinc-500">
            メンバーでスタミナ上限100、VIPで200になります。
          </p>
          <p className="mt-3 text-center text-sm text-amber-200">
            4チップでスタミナ1を回復できます。
          </p>
          {recoverError && (
            <p className="mt-2 text-center text-sm text-red-400">{recoverError}</p>
          )}
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRecover}
              disabled={recoverLoading}
              className="touch-target rounded-xl border border-amber-500/50 bg-amber-500/20 py-4 font-bold text-amber-200 active:opacity-90 hover:bg-amber-500/30 disabled:opacity-50"
            >
              {recoverLoading ? '処理中…' : `${CHIPS_PER_STAMINA}チップで1回復`}
            </button>
            <button
              onClick={onClose}
              className="touch-target rounded-xl bg-amber-500 py-4 font-bold text-black active:opacity-90 hover:bg-amber-400"
            >
              閉じる
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
