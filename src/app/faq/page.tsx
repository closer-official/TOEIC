'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: '瞬（しゅん）とは何ですか？',
    a: 'TOEIC Part 5 の文法問題と単語の暗記を、e スポーツ風のタイムアタックで楽しめる学習アプリです。全国ランキングや進化・装備などの要素で継続しやすくしています。',
  },
  {
    q: '無料でどこまで遊べますか？',
    a: '初回7日間は無制限にプレイできます。以降は1日1回まで無料でプレイ可能です。チップを購入したりサブスクリプションに加入すると、スタミナやルーレットの無料スピン回数が増えます。',
  },
  {
    q: 'チップは何に使いますか？',
    a: 'チップはショップでルーレット（ガチャ）を回したり、ギルドの作成、取引所でのアイテム購入、イベント内のアイテム購入などに使います。スタミナ切れ時もチップで補充できます。',
  },
  {
    q: 'スタミナが足りません。どうすれば増やせますか？',
    a: 'スタミナは時間経過で自動回復します。有料のメンバーシップ（Pro / VIP）に加入すると最大スタミナ数が増えます。また、ショップでチップを購入し、スタミナ補充に充てることもできます。',
  },
  {
    q: '課金したのにチップが反映されません。',
    a: 'Web版でStripe決済後、数秒以内にチップが付与されます。反映されない場合はアプリを再読み込みするか、しばらく時間をおいてからご確認ください。それでも解決しない場合は、設定内の「お問い合わせ」先までご連絡ください。',
  },
  {
    q: 'サブスクリプションの解約・返金はどうなりますか？',
    a: '解約手続きは、ご利用のストア（App Store / Google Play）または決済画面から行えます。返金については、各ストアのポリシーおよび特定商取引法に基づく表記に従います。',
  },
  {
    q: 'アカウントを削除したいです。',
    a: '設定画面の「退会」から案内を確認できます。データ削除のご希望は、設定内のお問い合わせ先（メール）までご連絡ください。記録保持の観点からメールでの対応とさせていただきます。',
  },
  {
    q: 'ランキングのスコアが記録されません。',
    a: '記録される条件は次のとおりです。(1) ログインしていること。(2) 「全国 Part 5」または「全国 単語」モードでプレイすること（「For You」モードはランキング対象外です）。(3) ゲームオーバー（TIME UP）までプレイすること。リザルト画面が表示された時点で自動的に記録を送信します。「終了」ボタンを押さなくても記録されます。通信エラー時は記録されないことがあります。',
  },
  {
    q: '不具合や要望を伝えたいです。',
    a: '設定画面の「よくある質問」や「プライバシーポリシー」の下にあるリンクから、利用規約・お問い合わせ先をご確認いただけます。メール（info@closer-official.com）にてお問い合わせください。',
  },
  {
    q: '会社概要・運営者情報はどこにありますか？',
    a: '会社概要は設定画面の「会社概要」からアプリ内の会社概要ページをご確認いただけます。事業者・決済・サポートの詳細は「事業者・サービス情報」、特定商取引法に基づく表記は設定内の「特定商取引法に基づく表記」からご確認ください。',
  },
];

export default function FAQPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ id: string } | null | 'loading'>('loading');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session?.user ? { id: data.session.user.id } : null);
    });
  }, []);

  useEffect(() => {
    if (session === null) router.replace('/login');
  }, [session, router]);

  if (session === 'loading' || session === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" aria-hidden />
        <LoadingWithPercent className="text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-zinc-950">
      <AppHeader backHref="/" />
      <main className="px-4 content-below-header pb-8 safe-area-pad sm:px-6">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-white sm:text-2xl">よくある質問</h1>
          <p className="mt-2 text-sm text-zinc-500">その他のお問い合わせは設定からご連絡ください。</p>

          <dl className="mt-6 space-y-6">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-4">
                <dt className="font-medium text-amber-200/90">Q. {item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-zinc-300">{item.a}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-8 text-center">
            <Link href="/" className="text-sm text-amber-500/80 hover:text-amber-400">
              ← ホームへ
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
