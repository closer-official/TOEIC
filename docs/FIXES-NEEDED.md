# 現在修正・確認が必要な可能性の高い箇所

コードベースとドキュメントを調査した結果の一覧です。（最終更新: 手動）

---

## 1. UI・文言の「準備中」表記（意図的ならそのまま）

| 箇所 | 内容 | 対応案 |
|------|------|--------|
| **ギルド** `src/app/guild/page.tsx` | ランキング・THE GRAND FLOOR タブで「Coming soon...」「準備中です」 | 実装するまで現状のまま。実装後にプレースホルダーを削除。 |
| **イベント** `src/app/event/page.tsx` | 「大会」セクション「準備中です。」／今週のイベントが EVENTS_WITH_CONTENT にない週は「今週のイベントは準備中です。」 | 大会を実装するか、文言を「大会は今後公開予定です」などに変更可能。 |
| **ゲーム** `src/app/game/page.tsx` (約1899行付近) | 単語 For You モードでカウントダウンが取れない場合「準備中...」 | データ取得失敗・未実装のフォールバック。仕様確認またはローディング表示に統一。 |
| **PaywallModal** `src/components/PaywallModal.tsx` | 「サブスク（準備中）」ボタンが `disabled` | サブスク決済を有効にする場合は有効化し、文言を「サブスクで加入」などに変更。 |
| **ギルドチャット** `src/app/api/guild/chat/route.ts` | 特定条件で「チャット機能は準備中です」を 503 返却 | チャットを提供する場合は実装後に該当分岐を削除。 |
| **装備装着** `src/app/api/equipment/equip/route.ts` | `profiles` に equipped 系カラムがない場合「装備スロット機能は準備中です」を 503 返却 | DB にカラムを追加済みなら発生しない。未追加ならマイグレーションで追加。 |
| **ショップ決済** `checkout/route.ts`, `checkout-embedded/route.ts`, `checkout-subscription/route.ts`, `cancel-subscription/route.ts` | `STRIPE_SECRET_KEY` 未設定時「決済機能は現在設定中です」で 503 | 本番では環境変数を設定。開発時は意図的なオフの可能性あり。 |
| **アバター/ギルドエンブレムアップロード** `upload/avatar/route.ts`, `upload/guild-emblem/route.ts` | ストレージ未設定などで 503 | ストレージ・環境変数の設定確認。 |
| **管理画面** `src/app/api/admin/auth.ts` | `ADMIN_SECRET` 未設定で 503 | 本番で管理を使う場合は環境変数設定。 |

---

## 2. データ・バッチ・運用

| 箇所 | 内容 | 対応案 |
|------|------|--------|
| **取引所レート** `src/app/api/exchange/route.ts` | `exchange_daily_snapshots` を参照しているが、**前日分を INSERT する日次ジョブ（cron / Edge Function / スクリプト）がコードベースにない** | 日次で `profiles` の `gems` / `evolution_points` を集計し、`exchange_daily_snapshots` に 1 行 INSERT する処理を追加。未投入時は `snapshotFound: false` のまま返しているので、クライアント側で固定レート（GEMS_PER_XP）のみ使っている可能性あり。要確認。 |
| **問題生成** `scripts/pipeline.ts` 等 | GitHub Actions 等で Supabase に問題を投入する想定。`OPENAI_API_KEY` 等の設定と本番実行の有無 | 本番で自動投入する場合は Secrets とワークフロー実行状況を確認。 |

---

## 3. ドキュメントの古い記述

| 箇所 | 内容 | 対応案 |
|------|------|--------|
| **docs/TODO_AND_RECOMMENDATIONS.md** | 「会社概要は準備中のみ」「イベントページ全体が準備中」「FAQ 準備中」等、**すでに実装済みの機能が未実装として書かれている** | 会社概要・イベント週替わり・FAQ の現状に合わせてドキュメントを更新するか、本ファイル（FIXES-NEEDED.md）を正とし TODO_AND_RECOMMENDATIONS をアーカイブ。 |

---

## 4. 本番環境変数・設定の確認

| 項目 | 内容 | 対応案 |
|------|------|--------|
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ULTRA`, `STRIPE_PRICE_PRO`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 本番用に切り替え済みか確認。Webhook は本番用シークレット・エンドポイント要。 |
| **Firebase** | `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` または `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` | 紹介者コード検証で使用。未設定だと紹介者ボーナスが動かない。 |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 必須。RLS・マイグレーション適用済みか確認。 |
| **管理画面** | `ADMIN_SECRET` | 管理機能を使う場合のみ設定。 |
| **アプリ URL** | `NEXT_PUBLIC_APP_URL` | メタデータ・Stripe リダイレクト等で使用。本番ドメインに設定。 |

---

## 5. ログ・デバッグ出力

| 箇所 | 内容 | 対応案 |
|------|------|--------|
| **API 各所** | `console.log` / `console.error` / `console.warn` が多数（例: stripe webhook 19 件、gacha/pull 5 件、evolution 5 件 等） | 本番ではログレベルを絞るか、構造化ログに寄せることを検討。機密情報（トークン・個人情報）を出していないか確認。 |

---

## 6. その他・要確認

| 箇所 | 内容 | 対応案 |
|------|------|--------|
| **Grand Floor マップ** `src/app/guild/grand-floor-map/page.tsx` | 凡例に「資源マス（効果は準備中）」 | 資源マス効果を実装するか、文言を「効果は今後実装予定」などに変更。 |
| **紹介者コード** `/api/referrer/validate?code=XXX` | コメント・ドキュメントの「XXX」はプレースホルダー。 | そのままで問題なし。 |
| **装備スロット** | `profiles` に `equipped_weapon_id` 等のカラムが無い場合、装着 API が 503 | マイグレーションでカラム追加済みか確認。 |

---

## 7. 優先度の目安

1. **本番リリース前に必須**
   - 環境変数（Stripe / Supabase / Firebase / NEXT_PUBLIC_APP_URL）の本番設定
   - 決済・紹介者・装着など「準備中」のままにしないなら、該当機能の有効化または文言・返却値の整理

2. **運用・データ整合**
   - `exchange_daily_snapshots` の日次投入（動的レートを使う場合）
   - 問題投入パイプラインの実行有無・Secrets 確認

3. **品質・保守**
   - `docs/TODO_AND_RECOMMENDATIONS.md` の更新または FIXES-NEEDED への統合
   - 本番用 `console.*` の見直し

4. **機能拡張（任意）**
   - 大会・ギルドランキング・Grand Floor・ギルドチャット・サブスクボタン の実装または「準備中」の明示
   - PaywallModal のサブスクを有効化する場合の文言・遷移先の変更
