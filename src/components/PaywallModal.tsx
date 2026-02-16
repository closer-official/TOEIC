'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
}

export function PaywallModal({ open, onClose }: PaywallModalProps) {
  if (!open) return null;

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
            本日1回の無料プレイが終了しました
          </h2>
          <p className="mt-4 text-center text-zinc-400">
            続けてプレイするには100円パスまたはサブスクをご利用ください。
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <a
              href="https://billing.stripe.com/pay/placeholder"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-xl bg-amber-500 py-4 font-bold text-black transition hover:bg-amber-400"
            >
              100円パスを購入
            </a>
            <a
              href="https://billing.stripe.com/pay/placeholder"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-xl border border-amber-500/50 py-4 font-bold text-amber-500 transition hover:bg-amber-500/10"
            >
              サブスクを確認
            </a>
            <button
              onClick={onClose}
              className="mt-2 py-2 text-sm text-zinc-500 hover:text-white"
            >
              あとで
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
