'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GachaPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/shop');
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <p className="text-zinc-400">ショップへ移動しています…</p>
    </div>
  );
}
