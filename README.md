This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 開発環境の移行（Windows ↔ Mac）

別のマシンで続きから開発する場合:

1. **リポジトリをクローン**
   ```bash
   git clone https://github.com/closer-official/TOEIC.git
   cd TOEIC
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **環境変数**
   - `.env.local` は Git に含まれません。Supabase の URL/Key などは Mac 側で新しく `.env.local` を作成するか、手元でコピーしてください。

4. **改行・パス**
   - リポジトリはクロスプラットフォームを想定しています。`.gitignore` で OS ごとの不要ファイル（`.DS_Store`, `Thumbs.db` など）を除外しています。

5. **Mac で Cursor から開く**
   ```bash
   cd TOEIC
   cursor .     # または Cursor を起動 → File → Open Folder → TOEIC を選択
   ```
   - 初回は `npm install` を実行してから `npm run dev` で起動してください。

### Git に上げるとき（push するとき）

- **秘密情報はコミットしない**: `.env.local` や Firebase のサービスアカウント鍵（`*-firebase-adminsdk-*.json`）は `.gitignore` に入れてあります。これらをコミットすると GitHub の Push Protection で拒否されます。
- **秘密を誤ってコミットした場合**: 該当ファイルを削除し `.gitignore` に追加したうえで、`git commit --amend` で直前のコミットを書き換えてから `git push` してください。すでに push してしまった場合は、GitHub の設定で該当シークレットを無効化し、新しい鍵に差し替えてください。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
