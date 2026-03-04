'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { LoadingWithPercent } from '@/components/LoadingWithPercent';

const WEB_SALES_URL = 'https://shun.closer-official.com/';
const APP_STORE_URL = 'App Store の当該アプリの商品ページ';

function TokushoContent() {
  const searchParams = useSearchParams();
  const isApp = useMemo(() => searchParams.get('platform') === 'app', [searchParams]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-zinc-950">
      <AppHeader backHref="/" />
      <main className="px-4 content-below-header pb-8 safe-area-pad sm:px-6">
        <div className="mx-auto max-w-lg">
          <h1 className="text-xl font-bold text-white sm:text-2xl">特定商取引法に基づく表記</h1>
          <p className="mt-2 text-sm text-zinc-500">最終更新: 2025年2月</p>
          {isApp && (
            <p className="mt-1 rounded border border-zinc-600 bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400">
              App Store版（アプリ内課金）
            </p>
          )}

          <div className="mt-6 space-y-4 text-sm text-zinc-300">
            <table className="w-full border-collapse">
              <tbody className="[&>tr]:border-b [&>tr]:border-zinc-700">
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200 w-36">販売事業者名</td>
                  <td className="py-3">Closer事務局</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">代表者</td>
                  <td className="py-3">小林 薫之介</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">所在地</td>
                  <td className="py-3">〒104-0061<br />東京都中央区銀座1丁目12番4号 N&E BLD.6F</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">電話番号</td>
                  <td className="py-3">050-1794-9630</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">メールアドレス</td>
                  <td className="py-3">
                    <a href="mailto:info@closer-official.com" className="text-amber-400 underline hover:text-amber-300">info@closer-official.com</a>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">お問い合わせ</td>
                  <td className="py-3">
                    サービス・販売に関するお問い合わせ・苦情は、記録保持の観点から原則としてメールにてお願いいたします。上記販売事業者が対応の責任を負います。
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">販売URL</td>
                  <td className="py-3">
                    {isApp ? APP_STORE_URL : <a href={WEB_SALES_URL} className="text-amber-400 underline hover:text-amber-300">{WEB_SALES_URL}</a>}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">販売商品</td>
                  <td className="py-3">
                    SHUN におけるアプリ内通貨（Chips）の一括購入およびサブスクリプション（Subscription）の月額・年額等。各商品の名称・内容・価格はショップ画面に表示する通りです。
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">役務の対価の額</td>
                  <td className="py-3">
                    ショップ画面に表示する各商品の価格に準じます。消費税は表示価格に含まれるか、別途表示に従います。
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">役務の提供時期</td>
                  <td className="py-3">
                    決済完了後、直ちに当該アカウントに Chips を付与、または Subscription の特典を利用可能な状態で提供します。
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">支払方法</td>
                  <td className="py-3">
                    {isApp
                      ? 'Apple のアプリ内課金（In-App Purchase）。クレジットカード・デビットカード・キャリア決済等、Apple が提供する決済手段に準じます。'
                      : 'クレジットカード、デビットカード（Stripe 経由）。サービス画面上に表示する決済手段に準じます。'}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">支払時期</td>
                  <td className="py-3">
                    Chips の一括購入は購入時。Subscription は各課金日に自動課金されます。
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">商品代金以外の必要料金</td>
                  <td className="py-3">通信費はお客様のご負担です。その他、明示した料金以外の費用はいただきません。</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">有効期限</td>
                  <td className="py-3">
                    購入した Chips および Subscription により提供された特典は、購入日または更新日から180日間を有効期限とし、期限経過後の未使用分は失効することがあります。
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">キャンセル・返品・返金</td>
                  <td className="py-3">
                    デジタルコンテンツの性質上、原則としてキャンセル・返品はお受けしておりません。不具合等によりサービスが利用できない場合など、当方に帰責事由があると判断した場合には、返金または代替対応を行うことがあります。返金を希望される場合は、購入後一定期間内にメールでご連絡ください。
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">動作環境</td>
                  <td className="py-3">本サービス利用時に表示している対応ブラウザ・OSに準じます。</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium text-zinc-200">事業者責任</td>
                  <td className="py-3">本表記に記載の販売事業者が、販売およびお問い合わせ・苦情対応の責任を負います。</td>
                </tr>
              </tbody>
            </table>
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

export default function TokushoPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <LoadingWithPercent className="text-zinc-500" />
      </div>
    }>
      <TokushoContent />
    </Suspense>
  );
}
