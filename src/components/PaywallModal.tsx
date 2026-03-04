'use client';

import Link from 'next/link';
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
            サブスクリプションまたはショップでチップを購入すると、スタミナやプレイ回数を増やして続けてプレイできます。
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <a
              href="/shop"
              className="flex w-full items-center justify-center rounded-xl border border-amber-500/50 py-4 font-bold text-amber-500 hover:bg-amber-500/10"
              aria-label="ショップでチップを購入"
            >
              ショップでチップを購入
            </a>
            <Link
              href="/shop#subscription"
              className="flex w-full items-center justify-center rounded-xl border border-amber-500/50 py-4 font-bold text-amber-500 hover:bg-amber-500/10"
              aria-label="サブスクで加入"
              onClick={onClose}
            >
              サブスクで加入
            </Link>
            <button
              type="button"
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
