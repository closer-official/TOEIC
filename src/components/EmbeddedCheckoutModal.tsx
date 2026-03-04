'use client';

import { useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

type Props = {
  open: boolean;
  onClose: () => void;
  packId: string | null;
};

export function EmbeddedCheckoutModal({ open, onClose, packId }: Props) {
  const fetchClientSecret = useCallback(async () => {
    if (!packId) throw new Error('商品を選択してください');
    const res = await fetch('/api/shop/checkout-embedded', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ packId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? '決済の開始に失敗しました');
    if (!data.clientSecret) throw new Error('決済情報の取得に失敗しました');
    return data.clientSecret;
  }, [packId]);

  if (!open || !packId) return null;
  if (!stripePromise) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="rounded-xl border border-gold-subtle bg-zinc-900 p-6 text-center">
          <p className="text-zinc-400">決済の設定がありません（NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY）</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-lg bg-zinc-700 px-4 py-2 text-white hover:bg-zinc-600"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span className="text-sm text-zinc-400">チップ購入</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          閉じる
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="min-h-full">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}
