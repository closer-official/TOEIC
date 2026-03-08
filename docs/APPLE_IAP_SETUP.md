# Apple IAP（アプリ内課金）設定

アプリ内でチップ・サブスクを販売する場合、App Store Connect で商品を登録し、**価格はウェブ版の 1.3 倍（30% 上乗せ）**で設定します。

## 商品ID（Product ID）

Bundle ID: `com.toeic-sigma.shun`

### チップ（消耗型）

| 商品ID | ウェブ価格（円） | App Store 設定価格（円）目安 |
|--------|------------------|------------------------------|
| com.toeic-sigma.shun.chips.mini | 50 | 65 |
| com.toeic-sigma.shun.chips.small | 500 | 650 |
| com.toeic-sigma.shun.chips.medium | 1000 | 1300 |
| com.toeic-sigma.shun.chips.large | 3000 | 3900 |
| com.toeic-sigma.shun.chips.xl | 5000 | 6500 |
| com.toeic-sigma.shun.chips.xxl | 10000 | 13000 |

**タイプ**: 消耗型（Consumable）

### サブスクリプション（自動更新）

| 商品ID | ウェブ月額（円） | App Store 設定価格（円）目安 |
|--------|------------------|------------------------------|
| com.toeic-sigma.shun.subscription.pro | 800 | 1040 |
| com.toeic-sigma.shun.subscription.ultra | 1500 | 1950 |

**タイプ**: 自動更新サブスクリプション（Auto-Renewable Subscription）。同一サブスクリプショングループに登録し、Pro と VIP の両方を含める。

## サーバー検証（必須）

1. **Apple ルート証明書**  
   [Apple PKI](https://www.apple.com/certificateauthority/) から **AppleRootCA-G3.cer** をダウンロードし、サーバーから読み込めるパスに配置する。

2. **環境変数**
   - `APPLE_ROOT_CA_PATH`: 上記 .cer ファイルの絶対パス（例: `/path/to/AppleRootCA-G3.cer`）
   - `APPLE_APP_STORE_ENVIRONMENT`: 本番は `Production`、審査・Sandbox テスト時は未設定または `Sandbox`（未設定時は Sandbox として検証）
   - `APPLE_BUNDLE_ID`: 未設定時は `com.toeic-sigma.shun` を使用

3. **Supabase マイグレーション**  
   `supabase/migrations/20260315000000_apple_iap.sql` を適用し、`apple_transactions` テーブルと `profiles.apple_subscription_expires_at` を作成する。

## 動作

- **Web**: 従来どおり Stripe（Embedded Checkout / リダイレクト）でチップ・サブスクを販売。
- **iOS アプリ**（Capacitor 実機）: StoreKit 2 経由で上記商品を取得・購入。購入後に `POST /api/shop/apple/verify` で JWS を送信し、サーバーで検証後にチップ付与またはサブスク反映。
- **価格表示**: iOS では App Store Connect に登録した価格（上記 1.3 倍）が StoreKit から返され、その `priceString` をそのまま表示する。

## 購入の復元

ショップ画面（iOS アプリ）に「購入を復元」ボタンを設置済み。タップで `restorePurchases()` を実行し、取得した取引をサーバー検証へ送り、二重付与防止のうえでチップ・サブスクを再反映する。
