# 紹介者コード（Firebase Firestore 連携）

紹介者コードは **Firebase Firestore** の `users/{accountId}` を参照して検証します。  
Supabase はそのまま。クーポン（紹介者）の「有効なコード一覧」だけ Firestore で管理します。

## 動き

1. ユーザーが設定の「紹介者コード」に入力して保存
2. サーバーが Firestore の **`users` コレクション** で、ドキュメント ID が入力コードと一致するかをチェック
3. 一致するドキュメントがあれば **有効** → プロフィールの `referrer_id` に保存（ずっとクーポン適用対象）
4. 一致しなければ **無効** → 「無効な紹介者コードです。」と返して保存しない

## 環境変数（Vercel / .env.local）

| 変数 | 説明 |
|------|------|
| `FIREBASE_PROJECT_ID` | プロジェクト ID（例: `Closer-official`）。未設定時は `Closer-official` を使用 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | サービスアカウントの JSON を **1行の文字列** でそのまま指定 |
| または `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` | 上記 JSON を Base64 エンコードした文字列 |

### サービスアカウントの取得

1. [Firebase Console](https://console.firebase.google.com/) → プロジェクト「Closer-official」
2. プロジェクトの設定 → サービスアカウント → 「新しい秘密鍵の生成」
3. ダウンロードした JSON を、Vercel の環境変数に **1行にした文字列** で貼るか、Base64 にして `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` に設定

### Firestore の構造

- コレクション: **`users`**
- ドキュメント ID = **有効な紹介者コード**（accountId）
- 中身は今は問わない（存在するかどうかだけ参照）。あとからクーポン内容を追加する場合は、このドキュメントにフィールドを足して参照できる。

## API

- **POST /api/profile**  
  保存時に `referrer_id` が空でなければ上記の Firestore 検証を行う。無効なら 400 で保存しない。
- **GET /api/referrer/validate?code=XXX**  
  紹介者コードの有効性だけを返す（`{ valid: true }` / `{ valid: false }`）。認証不要。

## クーポン特典（実装済み）

- **購入チップ 1.3 倍**  
  `referrer_id` が設定されているユーザーが、Stripe でチップを購入（サブスク初回付与・一括パック）した場合、付与チップを **1.3 倍**（端数切り捨て）してから加算します。  
  実装: `src/app/api/stripe/webhook/route.ts`（`REFERRER_CHIP_MULTIPLIER = 1.3`）。

その他の特典（ジェム付与・割引など）は、`referrer_id` を参照する処理を各所に追加して実装できます。

### 1.3 倍のゲームバランス

- **購入時のみ** のボーナスなので、ガチャ・スタミナ・ゲーム内 XP には影響しない。課金インセンティブに絞られている。
- **30% 増** は「お得感はあるが破綻しない」程度の水準。2 倍だと課金効率が上がりすぎる場合があるが、1.3 倍なら紹介経由ユーザーと通常ユーザーの差は抑えられる。
- 紹介者側への還元（紹介者にチップを渡す等）は未実装のため、現状は「紹介された側だけ得」で、紹介拡散と新規獲得の動機づけになる。
- 必要に応じて `REFERRER_CHIP_MULTIPLIER` を 1.2 や 1.5 に変更して調整可能。
