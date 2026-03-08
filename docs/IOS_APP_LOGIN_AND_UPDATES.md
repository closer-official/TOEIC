# 実機ビルド（iOS アプリ）: ログインのアプリ内完結と自動更新について

## 0. 作業の流れ（ウェブ版 vs App Store）

### ウェブ版（Windows / Cursor で完結）

1. **Cursor（Windows）でコードを編集**
2. **Git にコミット＆プッシュ**（任意だが推奨）
3. **本番反映**: `npx vercel --prod` を実行  
   - または Vercel と GitHub を連携していれば、push するだけで自動デプロイされる

**まとめ**: ウェブ版は Windows の Cursor だけで完結し、`npx vercel --prod`（または push による自動デプロイ）で本番に反映されます。

---

### App Store（iOS アプリ）の流れ — Mac にどう反映してアプリにするか

コードは **Git で共有**し、**Mac で pull → ビルド → Xcode でアーカイブ・提出**する形になります。

| どこで | 何をするか |
|--------|------------|
| **Windows（Cursor）** | コードを編集 → コミット → **push** |
| **Mac** | **pull** で最新を取得 → iOS 用ビルド → Xcode でアーカイブ → App Store Connect に提出 |

#### 手順（Mac 側）

1. **リポジトリを最新にする**  
   ```bash
   cd /path/to/closer
   git pull
   ```

2. **依存関係と iOS 用ビルド**  
   - `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定済みであることを確認  
   ```bash
   npm install
   npm run build:ios
   ```
   - これで `out/` に静的ファイルが出力される（`out/` は .gitignore なので Git には含めない）

3. **Capacitor で iOS プロジェクトを更新**  
   ```bash
   npx cap sync ios
   ```

4. **Xcode で開いてアーカイブ・提出**  
   ```bash
   npx cap open ios
   ```  
   - Xcode が開いたら: **Product → Archive** → アーカイブ後 **Distribute App** で App Store Connect にアップロード

**ポイント**

- **「Mac に反映」= Mac で `git pull` して最新のソースを取得すること**です。  
  Windows で push した内容が、Mac ではこの pull で入ります。
- **ビルド成果物（`out/`）は Git に含めず、Mac で毎回 `npm run build:ios` を実行**します。  
  そうすると、常に「今のコード」でアプリが組み上がります。
- Xcode のアーカイブ・審査提出は Mac でしかできないため、**「コードは Windows、アプリのビルド・提出は Mac」**という分担になります。

---

## 1. ログインがウェブで開いてしまう問題 → アプリ内で完結させる

### 原因

OAuth（Google / Apple ログイン）の `redirectTo` が **Web の URL**（例: `https://shun.closer-official.com/auth/callback`）になっていると、認証後に **Safari やブラウザ** が開き、アプリの WebView に戻りません。

### 対応内容（実装済み）

1. **アプリ用のリダイレクト URL（カスタム URL スキーム）**
   - **`npm run build:ios`** 実行時は `NEXT_PUBLIC_CAPACITOR_APP=1` が渡され、  
     `redirectTo` が常に **`com.toeic-sigma.shun://auth/callback`** になります（runtime の Capacitor に依存しない）。
   - 認証完了後、この URL で **アプリが再度起動**し、アプリ内に戻ります。

2. **アプリ起動時の処理**
   - Capacitor の `appUrlOpen` で「アプリが URL で開かれた」ことを検知し、  
     WebView を **`/auth/callback?code=xxx`** に遷移させています。
   - `/auth/callback` の**クライアント用ページ**（`page.tsx`）で `exchangeCodeForSession` を実行し、ログインを完了してから `/` にリダイレクトしています。

3. **iOS の設定**
   - `ios/App/App/Info.plist` に **URL スキーム** `com.toeic-sigma.shun` を追加済みです。

4. **Capacitor App プラグイン**
   - OAuth から戻った URL を受け取るために `@capacitor/app` を追加済みです。  
     実機ビルド前に `npm install` と **`npx cap sync ios`** を実行してください。

### あなたがやること（必須）

**Supabase ダッシュボードでリダイレクト URL を追加してください。**

1. [Supabase Dashboard](https://supabase.com/dashboard) → 対象プロジェクト
2. **Authentication** → **URL Configuration**
3. **Redirect URLs** に次を追加:
   - アプリ: `com.toeic-sigma.shun://auth/callback`
   - Web: `https://shun.closer-official.com/api/auth/callback`（本番ドメインに合わせて変更可）
4. 保存

これがないと、Supabase が「許可されていないリダイレクト先」としてエラーにし、アプリ内に戻れません。

### ログイン後もアプリに戻らないときの確認

- **Supabase**  
  **Redirect URLs** に **`com.toeic-sigma.shun://auth/callback`** が**正確に**1件入っているか確認（ typo や余分なスラッシュがないか）。
- **ビルド手順**  
  実機用には必ず **`npm run build:ios`** でビルドし、**`npx cap sync ios`** を実行してから Xcode で開く。通常の `npm run build` だけだと `redirectTo` が Web の URL のままになる。
- **Info.plist**  
  `ios/App/App/Info.plist` の **CFBundleURLSchemes** に `com.toeic-sigma.shun` が入っているか確認。

### 動作の流れ（アプリ内完結）

1. ユーザーがアプリで「Google でログイン」などをタップ
2. 認証画面が（Safari または in-app browser）で開く
3. 認証後、Supabase が **`com.toeic-sigma.shun://auth/callback?code=xxx`** にリダイレクト
4. **iOS がアプリを起動**（既に開いていればそのアプリに戻る）
5. アプリ内のリスナーが検知し、WebView を `/auth/callback?code=xxx` に遷移
6. クライアント側で `exchangeCodeForSession` を実行 → ログイン完了
7. `/` にリダイレクト → アプリ内でホームが表示される

---

## 2. 実機ビルド後の修正は自動でアップデートされるか？

### 結論: **いいえ、自動では更新されません。**

現在の構成（**静的エクスポート + Capacitor**）では:

- 実機ビルド（`npm run build:ios` → `npx cap sync ios` → Xcode でアーカイブ）で作ったアプリは、**その時点の HTML/JS/CSS がアプリにバンドル**されています。
- その後、コードを修正して Vercel にデプロイしても、**すでにインストールされているアプリの内容は変わりません**。
- ユーザーが更新を受け取るには、**App Store で新しいバージョンをリリースし、ユーザーがアプリを更新**する必要があります。

### 自動更新に近づけたい場合（任意）

- **Capacitor Live Updates**（Ionic Appflow）や **Microsoft CodePush** などを入れると、**審査なしで JS/HTML/CSS だけ**を配信し、次回起動時に差し替えることができます。
- その場合も、ネイティブ側の変更（Info.plist、新権限など）はストア審査付きのバージョンアップが必要です。
- 詳細は `docs/APP_STORE_ROADMAP.md` の「方法 C: 静的エクスポート + OTA 更新」を参照してください。

### まとめ

| 更新の種類           | 反映方法                         |
|----------------------|----------------------------------|
| サーバー・API の変更 | Vercel デプロイで即反映（アプリはそのまま） |
| アプリの見た目・ロジック | 新バージョンをビルド → ストアに提出 → ユーザーがアプリを更新 |
| OTA（JS だけの更新） | Live Updates / CodePush 等の導入が必要   |

---

## 3. 利用規約・プライバシーポリシーを Web 版と App Store 版で変える

### 結論: **できます。すでに実装済みです。**

- **同じ URL**（`/terms`・`/privacy`）で、**開いた環境に応じて表示を切り替え**ています。
- **Web**：Stripe による決済の説明（クレジットカード等）。
- **App Store 版**：Apple のアプリ内課金（In-App Purchase）の説明・自動更新の注意など。

### 判定の仕組み

- アプリから開いたときは **`?platform=app`** をつけるか、**Capacitor 判定**（実機ビルドでは `NEXT_PUBLIC_CAPACITOR_APP=1` または `window.Capacitor.isNativePlatform()`）で「App 版」とみなします。
- 設定・ゲームメニューなどから「利用規約」「プライバシーポリシー」へ飛ぶリンクは `/terms`・`/privacy` のままでよく、**アプリ内なら自動で App 向けの文言**が表示されます。

### さらに分けたい場合

- 条文の追加・差し替えは、`src/app/terms/page.tsx` と `src/app/privacy/page.tsx` の **`isApp`** で分岐を増やせば対応できます。
- 完全に別ページにしたい場合は、例として `/terms-app` と `/privacy-app` を用意し、アプリ内のリンクだけそこに向ける方法もあります。
