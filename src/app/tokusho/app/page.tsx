'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

/** App Store / アプリ内から開いたときに App 向け特商表記を表示するため ?platform=app へリダイレクト */
export default function TokushoAppPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tokusho?platform=app');
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <LoadingWithPercent className="text-zinc-500" />
    </div>
  );
}
