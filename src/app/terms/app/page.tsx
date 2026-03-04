'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

/** App Store / アプリ内から開いたときに App 向け利用規約を表示するため ?platform=app へリダイレクト */
export default function TermsAppPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/terms?platform=app');
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <LoadingWithPercent className="text-zinc-500" />
    </div>
  );
}
