'use client';

import Link from 'next/link';

const ANTIQUE_GOLD = '#C5A059';

/**
 * Stripe 本番審査用の「ビジネス・サービス情報」公開ページ。
 * ログイン不要でアクセス可能。ログイン画面と同じ世界観（黒背景・アンティークゴールド・セリフ体）で統一。
 * ダッシュボードの「ウェブサイトの URL」に https://your-domain.com/info を指定することを推奨。
 */
export default function InfoPage() {
  return (
    <div className="info-casino relative flex min-h-screen min-h-[100dvh] flex-col bg-black">
      {/* 金の二重線フレーム（ログイン画面と同様） */}
      <div className="info-double-border pointer-events-none fixed inset-4 z-10 sm:inset-6" aria-hidden />
      <div className="info-double-border pointer-events-none fixed inset-6 z-10 sm:inset-8" aria-hidden />

      <div className="relative z-0 flex flex-1 flex-col px-4 py-8 safe-area-pad sm:px-6 sm:py-10">
        {/* 戻るリンク */}
        <div className="mb-6">
          <Link
            href="/login"
            className="text-sm tracking-wide hover:opacity-90"
            style={{ color: ANTIQUE_GOLD, fontFamily: 'var(--font-playfair), Georgia, serif', letterSpacing: '0.12em' }}
          >
            ← アプリへ
          </Link>
        </div>

        {/* タイトル：サービス名＋見出し */}
        <header className="mb-10 text-center">
          <h1
            className="text-2xl font-medium tracking-[0.12em] sm:text-3xl"
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              background: `linear-gradient(180deg, ${ANTIQUE_GOLD} 0%, #a88b45 40%, #8b7340 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            }}
          >
            All-in ENGLISH
          </h1>
          <p
            className="mt-4 text-base tracking-[0.08em] text-zinc-500"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            事業者・サービス情報
          </p>
        </header>

        <div className="mx-auto w-full max-w-lg space-y-8 text-sm text-zinc-400">
          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{ color: ANTIQUE_GOLD, fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              ビジネス名
            </h2>
            <p className="text-zinc-300">Closer事務局</p>
          </section>

          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{ color: ANTIQUE_GOLD, fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              サービス名・販売商品の説明
            </h2>
            <p className="leading-relaxed text-zinc-300">
              <strong className="text-zinc-200">All-in ENGLISH</strong>
              は、TOEIC Part 5 の文法問題と英単語の暗記を、e スポーツ風のタイムアタックで楽しめる学習アプリです。全国ランキング・進化・装備などのゲーム要素で継続しやすくしています。
            </p>
            <p className="mt-3 leading-relaxed text-zinc-300">
              当サイトでは、<strong className="text-zinc-200">アプリ内通貨（Chips）の一括購入</strong>
              および<strong className="text-zinc-200">サブスクリプション（月額・年額）</strong>
              を販売しています。決済は Stripe によりクレジットカード・デビットカードで処理されます。商品の名称・内容・価格はショップ画面に表示する通りです。
            </p>
          </section>

          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{ color: ANTIQUE_GOLD, fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              カスタマーサポート・連絡先
            </h2>
            <ul className="space-y-1.5 text-zinc-300">
              <li>
                <strong className="text-zinc-200">メール:</strong>{' '}
                <a href="mailto:info@closer-official.com" className="underline hover:opacity-90" style={{ color: ANTIQUE_GOLD }}>
                  info@closer-official.com
                </a>
              </li>
              <li><strong className="text-zinc-200">電話:</strong> 050-1794-9630</li>
              <li><strong className="text-zinc-200">所在地:</strong> 〒104-0061 東京都中央区銀座1丁目12番4号 N&E BLD.6F</li>
            </ul>
            <p className="mt-2 text-zinc-500">
              サービス・販売に関するお問い合わせ・苦情は、記録保持の観点から原則としてメールにてお願いいたします。
            </p>
          </section>

          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{ color: ANTIQUE_GOLD, fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              返金・キャンセル・不審請求
            </h2>
            <p className="leading-relaxed text-zinc-300">
              デジタルコンテンツの性質上、原則としてキャンセル・返品はお受けしておりません。不具合等によりサービスが利用できない場合など、当方に帰責事由があると判断した場合には、返金または代替対応を行うことがあります。返金を希望される場合は、購入後一定期間内にメールでご連絡ください。不審請求・解約手続きは、利用規約および特定商取引法に基づく表記に従います。
            </p>
          </section>

          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{ color: ANTIQUE_GOLD, fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              法的表示・ポリシー
            </h2>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="underline hover:opacity-90" style={{ color: ANTIQUE_GOLD }}>利用規約</Link>
              </li>
              <li>
                <Link href="/privacy" className="underline hover:opacity-90" style={{ color: ANTIQUE_GOLD }}>プライバシーポリシー</Link>
              </li>
              <li>
                <Link href="/tokusho" className="underline hover:opacity-90" style={{ color: ANTIQUE_GOLD }}>特定商取引法に基づく表記</Link>
              </li>
            </ul>
          </section>
        </div>

        <p className="mt-12 text-center">
          <Link
            href="/login"
            className="inline-block rounded border px-6 py-3 text-sm tracking-[0.12em] transition hover:opacity-90"
            style={{
              borderColor: 'rgba(197,160,89,0.5)',
              color: ANTIQUE_GOLD,
              fontFamily: 'var(--font-playfair), Georgia, serif',
            }}
          >
            ログインへ
          </Link>
        </p>
      </div>

      {/* フッター：ログイン画面と同じスタイル */}
      <footer className="relative z-0 border-t py-3 safe-area-pad" style={{ borderColor: 'rgba(197,160,89,0.15)', backgroundColor: 'rgba(0,0,0,0.9)' }}>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 text-[9px] tracking-wider text-zinc-600"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          <Link href="/terms" className="hover:opacity-80" style={{ color: 'rgba(197,160,89,0.8)' }}>利用規約</Link>
          <span className="text-zinc-700">|</span>
          <Link href="/privacy" className="hover:opacity-80" style={{ color: 'rgba(197,160,89,0.8)' }}>プライバシーポリシー</Link>
          <span className="text-zinc-700">|</span>
          <Link href="/tokusho" className="hover:opacity-80" style={{ color: 'rgba(197,160,89,0.8)' }}>特定商取引法に基づく表記</Link>
        </nav>
      </footer>
    </div>
  );
}
