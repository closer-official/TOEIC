# App Store に出すためにやること（ロードマップ）

All-in ENGLISH を App Store で配信するための手順を、**やる順**にまとめています。

**本番 URL**: `https://shun.closer-official.com/`  
**iOS Bundle ID**: `com.toeic-sigma.shun`（Apple Developer 登録済み。Xcode プロジェクトもこの ID に設定済み）

---

## ビルド・配信の役割分担（PWA と iOS）

| 対象 | ビルド | 配信 |
|------|--------|------|
| **PWA / Web** | `npm run build`（従来どおり） | `npx vercel --prod` |
| **iOS（App Store）** | `npm run build:ios` → `npx cap sync ios` | Xcode で Archive → App Store Connect にアップロード |

- PWA 用の `npm run build` と `npx vercel --prod` は**そのまま**。変更しません。
- iOS 用は**別コマンド** `build:ios` で静的エクスポートし、Capacitor で `ios/` に反映してから Xcode でビルド・提出します。

### iOS でやること（毎回の流れ）

1. `npm run build:ios` … Next.js を静的エクスポート（`out/` に出力）
2. `npx cap sync ios` … `out/` を iOS プロジェクトにコピー
3. `npx cap open ios` … Xcode を開く
4. Xcode で **Product → Archive** → **Distribute App** → App Store Connect にアップロード
5. App Store Connect で該当ビルドを選び **審査に提出**

---

## この方式のデメリット（知ったうえで選ぶため）

採用する「静的エクスポート + 同じ API を https://shun.closer-official.com に飛ばす」方式には、次のようなデメリットがあります。

| デメリット | 内容 |
|------------|------|
| **ビルドが2本立て** | Vercel 用（`build`）と iOS 用（`build:ios`）の2つを維持する必要がある。静的エクスポートで使えない機能（一部の Server Components や API Routes をクライアントから直接叩けない部分）を増やすると、iOS 用ビルドだけ壊れる可能性がある。 |
| **オフラインでは API が使えない** | アプリの UI は端末内にあるが、ログイン・ランキング・課金などはすべて **https://shun.closer-official.com** の API に依存。オフライン時はこれらの処理は失敗する。PWA も同じサーバーに依存するなら、オフラインの制約は近い。 |
| **審査の印象** | 「単なる Web のラッパー」と見られると指摘されることがある。今回は **静的エクスポートで同じ React を配布**し、API だけリモートなので「アプリ内でロジックが動いている」形になっており、一般的には審査は通りやすい。WebView で URL 1本だけ表示する方式よりはリスクは小さい。 |
| **アップデートの届き方** | Web/PWA は `vercel --prod` で即反映。iOS は **ストア審査を通した新バージョン**を出すまでユーザーに届かない。緊急修正は Web ではすぐ反映できるが、iOS は次回アプリ更新まで待ってもらう形になる。 |
| **API のオリジン固定** | iOS ビルド時に `https://shun.closer-official.com` を埋め込む想定。ドメインを変える場合は iOS を再ビルドしてストアに更新が必要。 |

これらを許容できるなら、App Store 側の規約上の問題はなく、この方式で申請して問題ありません。

---

## 別の方法（デメリットをあまり許容できない場合）

前述のデメリット（二本立て・オフライン・更新の遅れ・API 固定）を避けたい場合は、次のような選択肢があります。

---

### 方法 A: WebView 方式（ビルドは1つだけ）

**やり方**: Capacitor のアプリは「中身は WebView で `https://shun.closer-official.com` を表示するだけ」。Next.js のビルドは **今の1つ**（`npm run build`）だけで、静的エクスポートは使わない。

| メリット | デメリット |
|----------|------------|
| ビルドは **1本**。`build:ios` 不要。 | 審査で **「単なる Web のラッパー」** と指摘され、リジェクトされる可能性が **静的エクスポートより高い**。 |
| サイトを更新すれば（vercel --prod）、アプリを開いたときに **即反映**。 | オフラインは依然として使えない（ネット必須）。 |
| API のドメイン変更も、サーバー側だけ対応すればよい。 | 「アプリとしての体裁」は弱く、Apple のガイドラインに引っかかりやすい。 |

**向いている人**: とにかくビルドを1本にしたいが、審査で落ちるリスクは受け入れる場合。

---

### 方法 B: App Store には出さず、PWA のみで配布

**やり方**: iOS 用のネイティブアプリは作らない。**「ホームに追加」**（PWA）だけを案内する。ビルド・配信は今どおり `npm run build` と `npx vercel --prod` のみ。

| メリット | デメリット |
|----------|------------|
| ビルド1本、更新は即時、追加の仕組みなし。 | **App Store にアプリは存在しない**。検索で見つけてもらいにくい。 |
| 課金は Web の Stripe のまま。Apple IAP 不要。 | 「アプリをストアでダウンロード」を期待するユーザーには届きにくい。 |
| デメリット（二本立て・更新遅れ・API 固定）が **すべて発生しない**。 | 配布は「公式サイトへ来て、ホームに追加して」に限定される。 |

**向いている人**: ストアの審査・IAP・二本立てを一切負いたくない場合。発見性より運用のシンプルさを優先する場合。

---

### 方法 C: 静的エクスポート + OTA 更新（デメリットの一部だけ緩和）

**やり方**: これまでの「静的エクスポート + Capacitor」はそのまま使い、**Capacitor Live Updates**（Ionic Appflow）や **Microsoft CodePush** で、**JS/HTML/CSS の更新だけ**を審査なしで配信する。

| メリット | デメリット |
|----------|------------|
| **「更新がストア審査まで届かない」** はかなり緩和される。不具合修正や軽い機能追加は OTA で即届けられる。 | **ビルド二本立ては残る**。Vercel 用と iOS 用の両方を維持する必要あり。 |
| ストアに出す「アプリとしての体裁」は維持できる。 | OTA のサービス利用（有料の可能性）と設定作業が増える。 |
| | オフライン不可・API オリジン固定は変わらない。 |

**向いている人**: 二本立ては受け入れるが、「iOS の更新が遅い」だけは避けたい場合。

---

### 方法 D: モバイルを別アプリ（Expo / React Native）で作る

**やり方**: Web は Next.js のまま。**iOS/Android 用は Expo や React Native で別アプリ**として作り、同じバックエンド（shun.closer-official.com の API）を叩く。

| メリット | デメリット |
|----------|------------|
| Web とモバイルで **責務が分かれる**。Next.js の静的エクスポートは不要。 | **別コードベース（または大きな共通化）** が必要で、工数が大きい。 |
| モバイル側でオフラインやプッシュなど、ネイティブ寄りの設計がしやすい。 | 開発・保守の負荷が増える。 |
| ストア審査で「ネイティブアプリ」として見られやすい。 | 現状の Next.js を活かしつつ、というより「モバイルは別プロダクト」に近い。 |

**向いている人**: 長期的にモバイルをしっかり作り込みたいが、短期の工数は許容できる場合。

---

### 比較の目安

|  | ビルド1本 | 審査リスク小 | 更新が即反映 | ストアに出す | 工数 |
|---|:---:|:---:|:---:|:---:|:---:|
| **これまでの方式（静的エクスポート）** | × | ○ | × | ○ | 中 |
| **A: WebView のみ** | ○ | × | ○ | △（通りにくい場合あり） | 小 |
| **B: PWA のみ** | ○ | 該当なし | ○ | ×（出さない） | なし |
| **C: 静的 + OTA** | × | ○ | △（OTA で緩和） | ○ | 中〜大 |
| **D: Expo/RN 別アプリ** | ○（Web のみ） | ○ | 要設計 | ○ | 大 |

---

**まとめ**:  
デメリットを**なるべく許容したくない**なら、

- **ストアには出さない**なら → **方法 B（PWA のみ）** が一番シンプルでデメリットもない。
- **ストアには出したいが、二本立て・更新遅れは避けたい**なら → **方法 A（WebView）** は審査リスクが高く、**方法 D（別アプリ）** は工数が大きい。
- **「更新が遅い」だけ嫌**なら → **方法 C（OTA 更新）** で、二本立てのまま更新だけ速くする、という折衷になる。

この中で、どの方向（B / A / C / D）に寄せたいか決めてもらえれば、その選択に合わせて次の具体的な手順を書ける。

---

## 全体の流れ

```
1. Apple Developer 登録
2. iOS アプリの「形」を作る（Capacitor）
3. App Store Connect でアプリ登録・メタデータ
4. アプリ内課金（IAP）の準備
5. 審査用の必須要素をそろえる
6. ビルドして提出
```

---

## ステップ 1: Apple Developer Program に登録

- **未登録の場合**: [Apple Developer Program](https://developer.apple.com/programs/) に加入（年間 12,800 円程度）。
- **登録済みの場合**: このステップはスキップして OK。

---

## ステップ 2: iOS アプリの「形」を作る（Capacitor）

いまは **Next.js の Web アプリ**だけなので、App Store に出すには **iOS 用のネイティブ（ラッパー）アプリ**が必要です。**Capacitor** で現在の Web を包みます。

### 2.1 やること一覧（実装済み）

| 番号 | 作業 | 状態 |
|------|------|------|
| 2.1.1 | Next.js を iOS 用に静的エクスポート | ✅ `BUILD_IOS=1` のときだけ `output: 'export'`（`next.config.ts`）。通常の `npm run build` は変更なし。 |
| 2.1.2 | Capacitor を入れる | ✅ `@capacitor/core` `@capacitor/ios` `@capacitor/cli` を追加済み。 |
| 2.1.3 | Capacitor の設定 | ✅ `capacitor.config.ts` で `webDir: 'out'`, `appId: 'com.toeic-sigma.shun'`。 |
| 2.1.4 | iOS プロジェクトを追加 | ✅ `npx cap add ios` 済み。`ios/` が存在。Windows では `pod install` は未実行（macOS で Xcode を開くときに実行）。 |
| 2.1.5 | ビルド＆同期 | ✅ `npm run build:ios` → `npm run cap:sync`（= `npx cap sync ios`）。API は `NEXT_PUBLIC_API_ORIGIN` で `https://shun.closer-official.com` に固定。 |
| 2.1.6 | Xcode で開く | `npx cap open ios` で Xcode が開く。署名・Bundle ID・チームを設定。 |

**補足**

- **静的エクスポートと API**: `build:ios` 時は全 API ルートに `dynamic = 'force-static'` と BUILD_IOS 時の 404 返却を追加済み。クライアントは `NEXT_PUBLIC_API_ORIGIN` により `https://shun.closer-official.com` に fetch する。
- **Windows で `build:ios` が EPERM で失敗する場合**: ビルド前に `scripts/prepare-ios-build.js` で `.next` と `out` を削除するようにしてある。それでも失敗する場合は、Cursor/VS Code をいったん閉じてからターミナルで `npm run build:ios` を実行するか、WSL や macOS でビルドする。
- **macOS での初回**: `ios/` を Xcode で開いたあと、必要に応じて `pod install`（CocoaPods が未実行の場合）を実行する。
- **新規 API ルートを追加した場合**: 静的エクスポートを通すため、そのルートに `export const dynamic = 'force-static';` と、ハンドラ先頭で `if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });` を追加する。一括反映には `node scripts/patch-api-for-static-export.js` を実行可能（既存ルートはスキップされる）。

### 2.2 注意点

- Next.js の **App Router** で `output: 'export'` を使う場合、SSR や API Routes は **使えません**。  
  → いまの構成では **API は Vercel のサーバー**で動かす想定なので、アプリは「その Vercel の URL を開く WebView」にするか、**静的エクスポートした HTML/JS だけを包み、API は `https://あなたのドメイン/api/...` に fetch する**形にします。
- つまり **2 通り** あります。  
  - **A) WebView 方式**: Capacitor の WebView で `https://all-in-english の本番URL` を表示するだけ。  
    - メリット: 実装が簡単。  
    - デメリット: オフライン不可、審査で「単なる Web のラッパー」と見られる可能性。  
  - **B) 静的エクスポート + API はリモート**: `out/` を包み、API だけ本番サーバーに飛ばす。  
    - メリット: アプリとしての体裁が良い。  
    - デメリット: Next.js を静的エクスポート可能な構成にする必要がある（API Routes は別ドメインに移すか、BFF を別サービスにする）。

まずは **A) WebView で本番 URL を表示** で申請まで進み、あとから B) に寄せることもできます。

### 2.3 アイコン・スプラッシュ

- **アプリアイコン**: 1024×1024 を 1 枚用意。Xcode の App Icon に設定。
- **スプラッシュ（起動画面）**: Xcode の Launch Screen または Capacitor のスプラッシュプラグインで設定。

詳細は既存の `docs/APPLE_NATIVE_AND_APPLE_PAY.md` を参照。

---

## ステップ 3: App Store Connect でアプリを登録する

1. [App Store Connect](https://appstoreconnect.apple.com/) にログイン。
2. **「マイ App」** → **「+」** → **「新規 App」**。
3. 次の項目を入力・選択する：
   - **プラットフォーム**: iOS
   - **名前**: 例）All-in ENGLISH
   - **主言語**: 日本語
   - **Bundle ID**: `com.toeic-sigma.shun`（Apple Developer 登録済み・Xcode プロジェクトも同一に設定済み）
   - **SKU**: 管理用の任意の文字列（例: `allinenglish-ios-1`）

4. **「App 情報」**で：
   - サブタイトル・説明文・キーワード
   - **プライバシーポリシー URL**: 本番の `https://あなたのドメイン/privacy` など
   - **カテゴリ**: 教育 or ゲーム など
   - **年齢**: 4+ など

5. **「価格と配信」**: 無料なら「無料」を選択。有料なら価格を設定。

6. **「App のレビュー情報」**:
   - **連絡先**: 審査用の電話番号・メール
   - **メモ**: テストアカウント（ログイン方法）があれば記載

7. **スクリーンショット**:  
   iPhone 6.7", 6.5", 5.5" など必要なサイズのスクショを用意してアップロード。

---

## ステップ 4: アプリ内課金（IAP）の準備

App Store の審査では、**アプリ内で売るデジタル商品（チップ・サブスク）は Apple IAP で提供する**必要があります。Stripe だけの課金は原則 NG です。

### 4.1 App Store Connect 側

| 番号 | 作業 | 内容 |
|------|------|------|
| 4.1.1 | Paid Apps 契約 | App Store Connect の **「契約・税金・銀行」** で **Paid Apps** に同意・銀行口座等を登録。 |
| 4.1.2 | IAP を有効化 | 対象アプリの **「機能」** で **In-App Purchase** を有効にする。 |
| 4.1.3 | 商品を作成 | **「In-App Purchase」** で商品を追加。例: チップ 500（Consumable）、チップ 1200（Consumable）、サブスク Pro（Auto-Renewable Subscription）など。価格を設定。 |

### 4.2 アプリ側（Xcode / コード）

| 番号 | 作業 | 内容 |
|------|------|------|
| 4.2.1 | StoreKit 2 で購入処理 | チップ購入・サブスク購入ボタンを押したときに、**StoreKit 2**（または Capacitor の IAP プラグイン）で Apple に購入リクエストを送る。 |
| 4.2.2 | レシートのサーバー検証 | 購入完了後、**レシート（トランザクション ID）を自分のサーバーに送り**、Apple のサーバーで検証。問題なければ DB に「チップ付与」「サブスク有効」を記録する。 |
| 4.2.3 | **購入の復元** | 設定やショップ画面に **「購入を復元」** ボタンを付け、同一 Apple ID で購入したサブスク等を復元できるようにする。**審査でほぼ必須**。 |

### 4.3 サーバー側（あなたのバックエンド）

- いま: Stripe の Webhook でチップ・サブスクを付与している。
- 追加で: **Apple のレシート検証用 API** を用意する。
  - 例: `POST /api/shop/apple-receipt` で、クライアントから送られたレシート（または transactionId）を受け取り、Apple の検証 API に問い合わせてから、`profiles.gems` や `subscription_tier` を更新する。

これで **Web は Stripe、iOS アプリは IAP** の二本立てにできます。

---

## ステップ 5: 審査で見られる要素をそろえる

| 項目 | やること |
|------|----------|
| **プライバシーポリシー** | 本番 URL を用意（例: `https://あなたのドメイン/privacy`）。App Store Connect の「App 情報」とアプリ内の両方に同じ URL を記載。 |
| **利用規約** | 同様に本番 URL（例: `/terms`）を用意し、アプリ内から見られるようにする。 |
| **アカウント削除（退会）** | ✅ すでに設定画面に「退会」がある。その旨、審査メモに書いておくとよい。 |
| **特定商取引法に基づく表記** | 有料販売する場合、事業者名・連絡先・返金等を記載したページ（例: `/about` 内または専用ページ）を用意。 |
| **問い合わせ先** | FAQ や about にメールアドレスを明記。App Store Connect の「レビュー用メモ」にも同じ連絡先を書く。 |
| **サービス名の統一** | 規約・プライバシー・about で「All-in ENGLISH」「Closer事務局」など表記を統一する。 |

---

## ステップ 6: ビルドして提出

1. **Xcode** で対象を **Any iOS Device (arm64)** にし、**Product → Archive**。
2. アーカイブ後、**Window → Organizer** から **「Distribute App」** → **App Store Connect** を選択してアップロード。
3. **App Store Connect** の「TestFlight」でビルドが処理されたら、**「App Store」** タブでそのビルドを選び、**「審査に提出」**。
4. **審査情報**（連絡先・メモ・テストアカウント）を再度確認して送信。

---

## よくある質問

**Q. Web 版（Stripe）はそのまま使える？**  
A. はい。Web でアクセスする分は Stripe のままで問題ありません。**App Store 経由の iOS アプリ内**でだけ、チップ・サブスクは Apple IAP にします。

**Q. まずは課金なしで出したい**  
A. チップ・サブスクをアプリ内で売らなければ、IAP は不要です。無料アプリとして申請し、のちに IAP を追加する形にできます。その場合も「購入の復元」は IAP を入れた時点で必要になります。

**Q. Capacitor ではなく PWA のままでは？**  
A. PWA（ホームに追加）だけでは **App Store には出せません**。ストアに出すには、Capacitor などでネイティブの「入れ物」を作る必要があります。

---

## まとめチェックリスト

- [ ] Apple Developer Program 登録
- [ ] Next.js を静的エクスポート or WebView 用に Capacitor で iOS プロジェクト追加
- [ ] アイコン 1024×1024・スプラッシュの準備
- [ ] App Store Connect でアプリ作成・メタデータ・スクリーンショット・プライバシー URL
- [ ] IAP 商品の作成（チップ・サブスク）
- [ ] アプリ内で StoreKit 2（または IAP プラグイン）＋ 購入の復元
- [ ] サーバーで Apple レシート検証 → チップ・サブスク付与
- [ ] 規約・プライバシー・特定商取引法・問い合わせ先の整備
- [ ] Xcode で Archive → App Store Connect にアップロード → 審査に提出

まずは **ステップ 2（Capacitor で iOS の形を作る）** から着手すると、その後の IAP や審査のイメージがつかみやすくなります。
