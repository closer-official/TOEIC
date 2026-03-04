'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';

function ShopReturnContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    fetch(`/api/shop/session-status?session_id=${encodeURIComponent(sessionId)}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.status ?? 'open');
        setCustomerEmail(data.customer_email ?? '');
      })
      .catch(() => setStatus('open'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <main className="flex flex-1 items-center justify-center p-4">
          <p className="text-zinc-400">確認中…</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
        <main className="flex flex-1 flex-col items-center justify-center p-6">
          <p className="text-center text-xl font-bold text-white">ご購入ありがとうございます</p>
          <p className="mt-2 text-center text-zinc-400">
            チップを付与しました。ショップに戻ってご利用ください。
          </p>
          {customerEmail && (
            <p className="mt-1 text-center text-sm text-zinc-500">確認メール: {customerEmail}</p>
          )}
          <Link
            href="/shop?success=1"
            className="mt-8 rounded-xl border border-gold-subtle bg-[var(--gold)]/20 px-6 py-3 font-medium text-gold hover:bg-[var(--gold)]/30"
          >
            ショップに戻る
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <p className="text-center text-zinc-400">決済が完了していません。</p>
        <Link
          href="/shop"
          className="mt-6 rounded-xl border border-gold-subtle bg-[var(--gold)]/20 px-6 py-3 font-medium text-gold hover:bg-[var(--gold)]/30"
        >
          ショップに戻る
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}

export default function ShopReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen min-h-[100dvh] flex-col bg-black">
          <main className="flex flex-1 items-center justify-center p-4">
            <p className="text-zinc-400">読み込み中…</p>
          </main>
          <BottomNav />
        </div>
      }
    >
      <ShopReturnContent />
    </Suspense>
  );
}
