'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

function PrivacyContent() {
  const searchParams = useSearchParams();
  const isApp = useMemo(() => searchParams.get('platform') === 'app', [searchParams]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-zinc-950">
      <AppHeader backHref="/" />
      <main className="px-4 content-below-header pb-8 safe-area-pad sm:px-6">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-white sm:text-2xl">プライバシーポリシー</h1>
          <p className="mt-2 text-sm text-zinc-500">最終更新: 2025年2月</p>
          {isApp && (
            <p className="mt-1 rounded border border-zinc-600 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400">
              App Store版（アプリ内課金による購入を含む）
            </p>
          )}

          <div className="mt-6 space-y-6 text-sm text-zinc-300">
            <section>
              <p className="leading-relaxed">
                Closer事務局（以下「当方」）は、サービス「SHUN」において、ユーザーの個人情報の保護に努めます。本ポリシーは、当方がどのような情報を収集し、どのように利用・保管するかを説明するものです。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">1. 収集する情報</h2>
              <p className="mt-2 leading-relaxed">
                本サービスでは、以下の情報を収集・利用する場合があります。
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-300">
                <li><strong className="text-zinc-200">認証情報</strong>：Google・Apple 等のログイン時に提供されるメールアドレス・表示名（各プロバイダのプライバシー設定に依存）</li>
                <li><strong className="text-zinc-200">プロフィール情報</strong>：ユーザーが入力するユーザー名、現在・目標TOEICスコア、次回受験日等</li>
                <li><strong className="text-zinc-200">利用データ</strong>：プレイ結果（スコア・正答率・ゲームモード）、ランキング用のスコア・合計時間、問題の正誤ログ（学習分析用）</li>
                <li><strong className="text-zinc-200">技術情報</strong>：アクセス元のIPアドレス、ブラウザ種類、デバイス情報（不具合対応・セキュリティのため）</li>
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-white">2. 利用目的</h2>
              <p className="mt-2 leading-relaxed">
                収集した情報は、本サービスの提供・維持・改善、ランキング・成長の軌跡等の機能の提供、お問い合わせ対応、不正利用の防止、法令に基づく対応に利用します。また、匿名化・集計したデータをサービス改善や統計に利用することがあります。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">3. 第三者への提供・業務委託</h2>
              <p className="mt-2 leading-relaxed">
                当方は、以下の場合を除き、ユーザーの個人情報を第三者に販売・譲渡しません。
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-300">
                <li>ユーザーの同意がある場合</li>
                <li>本サービス運営に必要な範囲で、業務委託先に預託する場合（当該事業者は契約上、適切な管理が求められます）</li>
                <li>法令に基づく開示請求があった場合</li>
              </ul>
              <p className="mt-2 leading-relaxed">
                本サービスでは、以下の外部サービスを利用しています。これらのサービスが収集するデータについては、各事業者のプライバシーポリシーが適用されます。
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-300">
                <li><strong className="text-zinc-200">認証・データベース</strong>：Supabase（Supabase Inc.）、Google・Apple 等のログイン機能</li>
                <li><strong className="text-zinc-200">ホスティング</strong>：Vercel（Vercel Inc.）</li>
                {isApp ? (
                  <li><strong className="text-zinc-200">アプリ内課金</strong>：Apple（Apple Inc.）の In-App Purchase。購入処理に必要な情報は Apple に送信され、当方はカード番号等の決済詳細を保持しません。</li>
                ) : (
                  <li><strong className="text-zinc-200">決済</strong>：Stripe（Stripe, Inc.）。ウェブ版における Chips・Subscription の支払いは Stripe により処理され、カード情報等は当方で保持せず、Stripe のプライバシーポリシーが適用されます。</li>
                )}
              </ul>
            </section>

            <section>
              <h2 className="font-semibold text-white">4. Cookie・ローカルストレージ</h2>
              <p className="mt-2 leading-relaxed">
                本サービスでは、ログイン状態の維持やプレイ回数の記録等のために、Cookie およびローカルストレージを使用します。これらは本サービスの動作に必要な範囲で利用し、第三者広告等の目的では使用しません。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">5. 保管期間・削除</h2>
              <p className="mt-2 leading-relaxed">
                個人情報は、本サービスの提供に必要な期間保管します。アカウントの削除は、本サービス内の設定からご自身で行うことができます。削除のご希望を当方で対応する場合や、利用停止・データの開示等のご要望は、お問い合わせメールアドレスまでご連絡ください。法令で保存が義務づけられている場合を除き、合理的な範囲で削除または匿名化いたします。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">6. お子様の利用</h2>
              <p className="mt-2 leading-relaxed">
                本サービスは、一般的な利用者を想定しています。未成年の方が利用される場合は、保護者の同意のうえでご利用ください。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">7. ポリシーの変更</h2>
              <p className="mt-2 leading-relaxed">
                当方は、必要に応じて本ポリシーを改定することがあります。重要な変更は本ページに掲載し、必要に応じてサービス内でお知らせします。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">お問い合わせ</h2>
              <p className="mt-2 leading-relaxed">
                個人情報の取扱いに関するお問い合わせは、下記までお願いいたします。<br />
                Closer事務局<br />
                <a href="mailto:info@closer-official.com" className="text-amber-400 underline hover:text-amber-300">info@closer-official.com</a>
              </p>
            </section>
          </div>

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

export default function PrivacyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <LoadingWithPercent className="text-zinc-500" />
      </div>
    }>
      <PrivacyContent />
    </Suspense>
  );
}
