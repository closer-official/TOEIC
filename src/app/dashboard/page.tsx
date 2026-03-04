'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 記憶の分布図は廃止。ホームへリダイレクト */
export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <p className="text-white">リダイレクト中...</p>
    </div>
  );
}
