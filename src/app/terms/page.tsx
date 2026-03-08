'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

function TermsContent() {
  const searchParams = useSearchParams();
  const isApp = useMemo(
    () =>
      searchParams.get('platform') === 'app' ||
      (typeof window !== 'undefined' &&
        (process.env.NEXT_PUBLIC_CAPACITOR_APP === '1' ||
          (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())),
    [searchParams]
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-zinc-950">
      <AppHeader backHref="/" />
      <main className="px-4 content-below-header pb-8 safe-area-pad sm:px-6">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-white sm:text-2xl">利用規約</h1>
          <p className="mt-2 text-sm text-zinc-500">最終更新: 2025年2月</p>
          {isApp && (
            <p className="mt-1 rounded border border-zinc-600 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400">
              App Store版（Apple のアプリ内課金による購入）
            </p>
          )}

          <div className="mt-6 space-y-6 text-sm text-zinc-300">
            <section>
              <h2 className="font-semibold text-white">第1条（適用）</h2>
              <p className="mt-2 leading-relaxed">
                本規約は、Closer事務局（以下「当方」）が提供するサービス「SHUN」および関連するウェブ・アプリサービス（以下「本サービス」）の利用条件を定めるものです。ユーザーは本規約に同意のうえ、本サービスを利用するものとします。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">第2条（利用登録・アカウント）</h2>
              <p className="mt-2 leading-relaxed">
                本サービスでは、認証プロバイダ（Google、Apple等）によるログインまたはゲスト利用が可能です。利用に際して提供された情報は、本サービスの提供・改善およびお問い合わせ対応に利用します。アカウントの管理責任はユーザーにあります。ユーザーはアプリ内の設定等からご自身でアカウントを削除することができます。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">第3条（禁止事項）</h2>
              <p className="mt-2 leading-relaxed">
                ユーザーは、本サービスの利用にあたり、法令または公序良俗に反する行為、当方または第三者の権利を侵害する行為、本サービスの運営を妨害する行為、不正アクセス・改ざん・不正な手段によるスコアの操作等を行ってはなりません。違反が認められた場合、利用制限またはアカウント停止を行うことがあります。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">第4条（有料サービス）</h2>
              <p className="mt-2 leading-relaxed">
                本サービスには無料で利用できる部分と、有料の部分があります。有料の内容は、(1) <strong className="text-zinc-200">Chips</strong>（アプリ内通貨）の一括購入、および (2) <strong className="text-zinc-200">Subscription</strong>（サブスクリプション）による継続課金で提供される特典（スタミナ・ガチャスピン等）です。料金・支払方法・キャンセル・返金等は、購入画面および特定商取引法に基づく表記に従うものとします。
              </p>
              {isApp ? (
                <p className="mt-2 leading-relaxed">
                  Chips および Subscription の支払いは、Apple のアプリ内課金（In-App Purchase）により行われます。お支払いには Apple の利用規約等が適用されます。Subscription は、お客様が更新日前にデバイス設定から解約しない限り、自動更新されます。
                </p>
              ) : (
                <p className="mt-2 leading-relaxed">
                  ウェブ版における Chips および Subscription の支払いは、Stripe によりクレジットカード・デビットカードで処理されます。当方はカード情報を保持せず、Stripe のプライバシーポリシーに従って決済が行われます。
                </p>
              )}
              <p className="mt-2 leading-relaxed">
                有料の購入に関する契約は、<strong className="text-zinc-200">決済が完了した時点</strong>で成立します。決済完了後は、法令に基づく場合または当方に帰責事由がある場合（不具合等）を除き、キャンセル・返金はお受けできません。購入した Chips および Subscription による特典は、購入日または更新日から<strong className="text-zinc-200">180日間</strong>を有効期限とし、これを経過した未使用分は失効することがあります。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">第5条（知的財産権）</h2>
              <p className="mt-2 leading-relaxed">
                本サービスに含まれるコンテンツ・デザイン・ロゴ・プログラム等の知的財産権は当方または正当な権利者に帰属します。ユーザーは、私的使用の範囲を超えて複製・改変・転載・営利利用等を行ってはなりません。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">第6条（免責・サービスの変更・終了・アカウント）</h2>
              <p className="mt-2 leading-relaxed">
                本サービスは現状有姿で提供されます。当方は、本サービスの完全性・正確性・特定目的への適合性を保証しません。また、予告なく内容の変更・一時停止・終了を行う場合があり、これに伴う損害について当方は責任を負いません。法令により認められる範囲で、損害賠償責任は有料サービスにおいて支払済み料金の範囲に限るものとすることがあります。
              </p>
              <p className="mt-2 leading-relaxed">
                ユーザーは、本サービス内の設定または当方への連絡によりアカウントの削除を請求することができます。当方は、禁止事項に違反した場合、または運営上・法令上必要と判断した場合、アカウントの利用制限または停止を行うことがあります。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">第7条（規約の変更）</h2>
              <p className="mt-2 leading-relaxed">
                当方は必要に応じて本規約を変更することがあります。変更後は本ページに掲載した時点で効力を生じるものとし、重要な変更の場合はサービス内での告知を行うことがあります。変更後に本サービスを利用した場合、変更後の規約に同意したものとみなします。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">第8条（準拠法・管轄）</h2>
              <p className="mt-2 leading-relaxed">
                本規約の解釈および本サービスに関する紛争には日本法を準拠法とし、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-white">お問い合わせ</h2>
              <p className="mt-2 leading-relaxed">
                本規約に関するお問い合わせは、下記までお願いいたします。<br />
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

export default function TermsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <LoadingWithPercent className="text-zinc-500" />
      </div>
    }>
      <TermsContent />
    </Suspense>
  );
}
