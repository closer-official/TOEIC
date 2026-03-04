'use client';

import Link from 'next/link';

const ANTIQUE_GOLD = '#C5A059';

/**
 * 会社概要ページ。ログイン不要でアクセス可能。
 * /info と同様の世界観（黒背景・アンティークゴールド・セリフ体）で統一。
 */
export default function AboutPage() {
  return (
    <div className="info-casino relative min-h-screen min-h-[100dvh] bg-black">
      {/* 外枠（二重線）：枠の内側にコンテンツエリアを配置 */}
      <div className="info-double-border pointer-events-none fixed inset-4 z-10 sm:inset-6" aria-hidden />
      <div className="info-double-border pointer-events-none fixed inset-6 z-10 sm:inset-8" aria-hidden />

      {/* 枠内のスクロール領域（内側の金枠に合わせた位置） */}
      <div className="fixed inset-6 overflow-y-auto sm:inset-8 z-0 safe-area-pad">
        <div className="mx-auto flex min-h-full flex-col px-2 py-6 sm:px-4 sm:py-8">
          {/* タイトル */}
          <header className="mb-10 flex-shrink-0 text-center">
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
            会社概要
          </h1>
          <p
            className="mt-4 text-base tracking-[0.08em] text-zinc-500"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Company Overview
          </p>
        </header>

        <div className="mx-auto w-full max-w-lg space-y-8 text-sm text-zinc-400">
          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{
                color: ANTIQUE_GOLD,
                fontFamily: 'var(--font-playfair), Georgia, serif',
              }}
            >
              事業者名
            </h2>
            <p className="text-zinc-300">Closer事務局</p>
          </section>

          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{
                color: ANTIQUE_GOLD,
                fontFamily: 'var(--font-playfair), Georgia, serif',
              }}
            >
              サービス名
            </h2>
            <p className="text-zinc-300">
              <strong className="text-zinc-200">All-in ENGLISH</strong>
              <span className="ml-1">（オールイン・イングリッシュ）</span>
            </p>
            <p className="mt-2 leading-relaxed text-zinc-400">
              知性を、全賭け（オールイン）せよ。TOEIC Part 5 と英単語の暗記を、e スポーツ風タイムアタックで楽しむ学習アプリです。
            </p>
          </section>

          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{
                color: ANTIQUE_GOLD,
                fontFamily: 'var(--font-playfair), Georgia, serif',
              }}
            >
              事業内容（Service）
            </h2>
            <div className="space-y-6 leading-relaxed text-zinc-300">
              <div>
                <p className="font-medium text-zinc-200">1. Entertainment Learning 事業</p>
                <p className="mt-1 text-sm">
                  「遊び」を「学び」に変え、夢中を生み出す。
                  勉強を「苦行」ではなく「最高のエンターテインメント」へと再定義します。第一弾プロダクト『All-in English』をはじめ、最新のゲームデザインと学習効率を融合させたアプリを展開。ユーザーが時間を忘れて没頭するうちに、一生モノのスキルが身につく体験を提供します。
                </p>
              </div>
              <div>
                <p className="font-medium text-zinc-200">2. Referral Economy 事業（closer）</p>
                <p className="mt-1 text-sm">
                  「貢献」を「価値」に直結させ、経済を循環させる。
                  良いプロダクトを広める「紹介者」の熱量を、業界最高水準の報酬（最大70%還元）で評価する次世代の経済基盤『closer』を運営。すべての学習アプリの裏側を支える共通の報酬エンジンとして、ユーザーが成長しながら正当な対価を得られる新しいエコシステムを構築します。
                </p>
              </div>
              <div>
                <p className="font-medium text-zinc-200">3. Creative Support 事業（Brand OS）</p>
                <p className="mt-1 text-sm">
                  「才能」を「市場」へ、リスクゼロで解き放つ。
                  初期費用や在庫リスクという既存のアパレル業界の壁を破壊し、デザインひとつで自分のブランドを創設できる成功報酬型プラットフォーム。特定の夢を持つ挑戦者が、資本の壁に阻まれることなく自己実現できる環境をバックアップします。
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{
                color: ANTIQUE_GOLD,
                fontFamily: 'var(--font-playfair), Georgia, serif',
              }}
            >
              所在地
            </h2>
            <p className="leading-relaxed text-zinc-300">
              〒104-0061<br />
              東京都中央区銀座1丁目12番4号 N&E BLD. 6F
            </p>
          </section>

          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{
                color: ANTIQUE_GOLD,
                fontFamily: 'var(--font-playfair), Georgia, serif',
              }}
            >
              お問い合わせ
            </h2>
            <ul className="space-y-1.5 text-zinc-300">
              <li>
                <strong className="text-zinc-200">メール:</strong>{' '}
                <a
                  href="mailto:info@closer-official.com"
                  className="underline hover:opacity-90"
                  style={{ color: ANTIQUE_GOLD }}
                >
                  info@closer-official.com
                </a>
              </li>
              <li>
                <strong className="text-zinc-200">電話:</strong> 050-1794-9630
              </li>
            </ul>
            <p className="mt-2 text-zinc-500">
              サービス・販売に関するお問い合わせは、記録保持の観点から原則としてメールにてお願いいたします。
            </p>
          </section>

          <section>
            <h2
              className="mb-2 text-xs font-medium tracking-[0.2em] uppercase"
              style={{
                color: ANTIQUE_GOLD,
                fontFamily: 'var(--font-playfair), Georgia, serif',
              }}
            >
              関連ページ
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/info"
                  className="underline hover:opacity-90"
                  style={{ color: ANTIQUE_GOLD }}
                >
                  事業者・サービス情報（決済・サポート等）
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="underline hover:opacity-90"
                  style={{ color: ANTIQUE_GOLD }}
                >
                  利用規約
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="underline hover:opacity-90"
                  style={{ color: ANTIQUE_GOLD }}
                >
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link
                  href="/tokusho"
                  className="underline hover:opacity-90"
                  style={{ color: ANTIQUE_GOLD }}
                >
                  特定商取引法に基づく表記
                </Link>
              </li>
            </ul>
          </section>
        </div>

        <p className="mt-12 text-center">
          <Link
            href="/"
            className="inline-block rounded border px-6 py-3 text-sm tracking-[0.12em] transition hover:opacity-90"
            style={{
              borderColor: 'rgba(197,160,89,0.5)',
              color: ANTIQUE_GOLD,
              fontFamily: 'var(--font-playfair), Georgia, serif',
            }}
          >
            トップへ
          </Link>
        </p>

        {/* フッター（枠内スクロールの末尾） */}
        <footer
            className="mt-12 border-t py-4"
            style={{
              borderColor: 'rgba(197,160,89,0.15)',
            }}
        >
          <nav
            className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 text-[9px] tracking-wider text-zinc-600"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            <Link href="/terms" className="hover:opacity-80" style={{ color: 'rgba(197,160,89,0.8)' }}>
              利用規約
            </Link>
            <span className="text-zinc-700">|</span>
            <Link href="/privacy" className="hover:opacity-80" style={{ color: 'rgba(197,160,89,0.8)' }}>
              プライバシーポリシー
            </Link>
            <span className="text-zinc-700">|</span>
            <Link href="/tokusho" className="hover:opacity-80" style={{ color: 'rgba(197,160,89,0.8)' }}>
              特定商取引法に基づく表記
            </Link>
          </nav>
        </footer>
        </div>
      </div>
    </div>
  );
}
