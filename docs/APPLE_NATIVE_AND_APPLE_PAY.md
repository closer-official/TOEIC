# Apple ネイティブアプリ化 ＋ Apple Pay 導入ガイド

**目標**: iOS ネイティブアプリを App Store にリリースしつつ、Web 版も継続。**Web 版は Stripe のみ**、**iOS ネイティブで Apple Pay を利用**する前提。

**前提**: Apple Developer Program は加入済み。

---

## 1. 全体像

| 配信先 | 技術 | 決済 |
|--------|------|------|
| **Web 版**（現状） | Next.js → Vercel | **Stripe のみ**（カード等）。Apple Pay は使わない。 |
| **iOS ネイティブ** | 同一コードベースを **Capacitor** でラップ | **A) Apple IAP（StoreKit）** または **B) Stripe Managed Payments**。いずれでもユーザーは Apple Pay を支払い方法に選択可能。 |

- **Web 版も出し続ける** = Next.js をそのまま維持し、iOS 用に Capacitor でラップする形が現実的です。
- **Apple Pay の設定は iOS ネイティブ側だけでよい**（Web では不要）。

---

## 2. ネイティブアプリ化（Web 版はそのまま）

### 2.1 選べる方法

- **Capacitor（推奨）**  
  - 既存の Next.js を **ビルドした静的サイト** を WebView で表示する形。  
  - 同じリポジトリで `npm run build` → `output: 'export'` または SSR をやめて静的エクスポートし、Capacitor の `webDir` に指定。  
  - iOS 用のネイティブプロジェクトだけが増える。Web 版は今まで通り Vercel にデプロイ。
- **Expo (Web + iOS)**  
  - React を共通にしつつ、Next.js ではなく Expo の Web ビルドと iOS ビルドに寄せる方法。  
  - 既存の Next.js をかなり書き換える必要があるため、**新規に Expo で作り直す**か、**Capacitor でラップする**かのどちらかになります。

**結論**: 現状の Next.js を活かすなら **Capacitor で iOS 用ラッパーを追加**し、Web は今の Vercel のままが最小工数です。

### 2.2 Capacitor で必要な追加設定（概要）

1. **パッケージの追加**
   - `@capacitor/core`, `@capacitor/ios`, `@capacitor/cli` をインストール。
2. **Next.js の静的エクスポート**
   - `next.config.js` で `output: 'export'` を設定し、`out/` に静的ファイルを出力。Capacitor の `webDir` を `out` に指定。
3. **iOS プロジェクトの生成**
   - `npx cap add ios` で Xcode 用プロジェクトが生成される。
4. **App Store 提出用**
   - Apple Developer Program 登録（有料）。
   - App Store Connect でアプリ登録、アイコン・スクリーンショット・説明文・プライバシーポリシー URL 等を設定。
   - 署名・プロビジョニング（Xcode / App Store Connect で設定）。

---

## 3. Apple Pay を「どこで」使うか

### 3.1 Web 版

- **Stripe のみ**（カード決済等）。Apple Pay は導入しないため、**Apple Pay 用のドメイン検証や Merchant ID は不要**です。

### 3.2 iOS ネイティブアプリで「デジタル商品」を売る場合

Apple のポリシーでは、**アプリ内で消費するデジタル商品・コンテンツ・サブスク**は、原則 **App Store の In-App Purchase（IAP）** で提供する必要があります。

選択肢は次の 2 つです。

| 方式 | 内容 | Apple Pay |
|------|------|-----------|
| **A) Apple IAP（StoreKit 2）** | 課金をすべて Apple 経由。Apple が 15〜30% 手数料を取る。 | ユーザーが支払い方法に Apple Pay を選べる。 |
| **B) Stripe Managed Payments** | アプリ内では「購入」ボタンのみ。Safari で Stripe Checkout を開き、支払い後にアプリへ戻る。対象国・商品の条件あり。 | Checkout 画面で Apple Pay を表示可能（Safari 上）。 |

- **100円パス・サブスク** はデジタル商品なので、**ストア審査を考えると A) IAP が無難**です。  
- **B)** を使う場合は、Stripe の [Managed Payments](https://docs.stripe.com/payments/managed-payments/set-up-mobile) の対象国・利用規約を確認してください。

---

## 4. Apple Pay の「追加設定」（iOS ネイティブのみ）

**Web 版では Apple Pay を使わないため、Merchant ID やドメイン検証は不要です。** 以下は iOS ネイティブアプリで Apple Pay を使う場合のみです。

### 4.1 ネイティブ iOS で IAP + Apple Pay を使う場合

- **Apple Pay 用の追加設定は不要**です。  
  - ユーザーが iPhone で Apple Pay を有効にしていれば、IAP の支払い方法として **Apple Pay** が選べます。
- 必要なのは **IAP 側の設定**だけです:
  - App Store Connect で **In-App Purchase** を有効化。
  - **Paid Apps Agreement** を契約。
  - 商品（100円パス＝Consumable / Non-Consumable、サブスク＝Auto-Renewable）を作成。
  - アプリ内で **StoreKit 2**（または StoreKit 1）で購入・復元を実装。

### 4.2 ネイティブ iOS で Stripe Managed Payments を使う場合

- 支払いは **Safari で行う**ため、このときだけ **Apple Pay 用の設定**（Merchant ID、ドメイン検証、Stripe で Apple Pay 有効化）が必要です。
- さらに:
  - **Universal Links**: 支払い完了後の `success_url` でアプリに戻す。
  - ドメインに **apple-app-site-association** を配置（`applinks:yourdomain.com` 等）。
  - Xcode で **Associated Domains** に `applinks:yourdomain.com` を追加。

---

## 5. やることチェックリスト（Apple 向け）

### 全般

- [x] **Apple Developer Program** に登録 … **加入済み**
- [ ] **App Store Connect** でアプリを作成し、名前・説明・スクリーンショット・プライバシーポリシー URL・カテゴリ等を設定。
- [ ] **プライバシーポリシー** と **利用規約** を公開 URL で用意し、App Store Connect とアプリ内の両方に記載。

### Web 版（Stripe のみ）

- [ ] **Stripe** で Checkout または Payment Element を実装（カード決済等）。**Apple Pay は有効にしない**ため、Merchant ID・ドメイン検証は不要。

### Web 版を維持しつつネイティブ化

- [ ] **Capacitor** を導入し、Next.js を静的エクスポートして `ios` プロジェクトを追加。
- [ ] **アイコン**（1024x1024 含む）と **スプラッシュ** を用意。
- [ ] **Sign in with Apple** をアプリで使う場合は、Apple Developer で App ID に Capability を追加。

### ネイティブで課金する場合

- [ ] **IAP** を使う: App Store Connect で IAP を有効化し、商品と価格を登録。アプリで StoreKit 2 を実装。  
  → **Apple Pay 専用設定は不要**（ユーザーが支払い方法に Apple Pay を選べる）。
- [ ] **Stripe Managed Payments** を使う: Apple Pay を使う場合のみ、Merchant ID・ドメイン検証・Stripe の Apple Pay 有効化に加え、Universal Links と Associated Domains を設定。

### バックエンド（共通）

- [ ] **購入状態の永続化**: `subscriptions` や `purchases` テーブル、Stripe Customer ID とユーザー紐付け。
- [ ] **Webhook**: Stripe の `checkout.session.completed` 等で購入完了を検知し、DB を更新。
- [ ] **プレイ制限**: 課金状態をサーバーで確認し、無料枠を超えたらペイウォールを表示（サーバー側チェックの追加を推奨）。

---

## 6. まとめ

- **Web 版**: **Stripe のみ**（カード等）。Apple Pay は使わないので、**Merchant ID・ドメイン検証は不要**です。
- **ネイティブアプリ化**: **Capacitor** で iOS 用ラッパーを追加。Web は Vercel のまま、同一コードベースで両方提供可能。
- **Apple Developer Program**: 加入済みのため、あとは App Store Connect と IAP / Capability の設定を進めればよいです。
- **Apple Pay**: **iOS ネイティブで IAP を選ぶ場合は追加設定不要**。Stripe Managed Payments でネイティブから Safari で支払いする場合のみ、Apple Pay 用の Merchant ID・ドメイン検証が必要です。
