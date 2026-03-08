/**
 * iOS 用ビルドを一時ディレクトリで実行し、out をプロジェクトにコピーする。
 * Windows で out への copyfile が EPERM になるのを避けるため、
 * API ルートなしのコピーでビルドし、out だけを本番に取り込む。
 */
const { rmSync, existsSync, mkdirSync, cpSync, readdirSync, statSync } = require("fs");
const { join } = require("path");
const { execSync } = require("child_process");

const root = join(__dirname, "..");
const tempDir = join(root, ".ios-build");
const excludeDirs = new Set(["node_modules", ".next", "out", ".git", "ios", ".ios-build"]);

function copyRecursive(src, dest, skipApi = false) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const srcPath = join(src, name);
    const destPath = join(dest, name);
    if (skipApi && src === join(root, "src", "app") && name === "api") continue;
    if (excludeDirs.has(name)) continue;
    const st = statSync(srcPath);
    if (st.isDirectory()) {
      copyRecursive(srcPath, destPath, skipApi);
    } else {
      mkdirSync(join(destPath, ".."), { recursive: true });
      cpSync(srcPath, destPath);
    }
  }
}

function copyFileOrDir(src, dest) {
  const st = statSync(src);
  if (st.isDirectory()) {
    copyRecursive(src, dest, false);
  } else {
    mkdirSync(join(dest, ".."), { recursive: true });
    cpSync(src, dest);
  }
}

console.log("Preparing iOS build in temporary directory...");

if (existsSync(tempDir)) {
  rmSync(tempDir, { recursive: true, maxRetries: 3, retryDelay: 200 });
}
mkdirSync(tempDir, { recursive: true });

const copyList = [
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "next-env.d.ts",
  "tsconfig.json",
  "public",
  "data",
  "src",
  ".env.local",
];
const optional = [".env.local", "data", "next-env.d.ts"];
for (const name of copyList) {
  const src = join(root, name);
  if (!existsSync(src) && optional.includes(name)) continue;
  if (!existsSync(src)) {
    console.warn("Skip (not found):", name);
    continue;
  }
  const dest = join(tempDir, name);
  if (name === "src") {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      const s = join(src, entry);
      const d = join(dest, entry);
      if (entry === "app") {
        mkdirSync(d, { recursive: true });
        for (const appEntry of readdirSync(s)) {
          if (appEntry === "api") continue;
          copyFileOrDir(join(s, appEntry), join(d, appEntry));
        }
      } else {
        copyFileOrDir(s, d);
      }
    }
  } else {
    copyFileOrDir(src, dest);
  }
}

const configFiles = ["postcss.config.js", "postcss.config.mjs", "tailwind.config.js", "tailwind.config.ts"];
for (const name of configFiles) {
  const src = join(root, name);
  if (existsSync(src)) cpSync(src, join(tempDir, name));
}

// 実機ビルドで Supabase が動くように .env.local の必須変数をチェック
const envLocalPath = join(tempDir, ".env.local");
if (existsSync(envLocalPath)) {
  const { readFileSync } = require("fs");
  const content = readFileSync(envLocalPath, "utf8");
  if (!content.includes("NEXT_PUBLIC_SUPABASE_URL") || !content.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    console.error("\n[ERROR] .env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。");
    console.error("実機でログインするにはビルド時にこれらの値がバンドルに含まれる必要があります。\n");
    process.exit(1);
  }
} else {
  console.error("\n[ERROR] .env.local がありません。プロジェクト直下に .env.local を作成し、");
  console.error("NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してから npm run build:ios を実行してください。");
  console.error("（Supabase ダッシュボードの Settings > API から取得できます）\n");
  process.exit(1);
}

console.log("Installing dependencies in temp...");
execSync("npm ci", { cwd: tempDir, stdio: "inherit", shell: true });

// iOS ビルドでは @capacitor/app を直接使うよう capacitor-app.ts を差し替え（temp では npm ci で入る）
const { writeFileSync } = require("fs");
const capAppPath = join(tempDir, "src", "lib", "capacitor-app.ts");
writeFileSync(
  capAppPath,
  "export { App } from '@capacitor/app';\n",
  "utf8"
);

console.log("Running Next.js build (static export, no API routes)...");
execSync(
  "npx next build",
  {
    cwd: tempDir,
    env: {
      ...process.env,
      BUILD_IOS: "1",
      NEXT_PUBLIC_API_ORIGIN: "https://shun.closer-official.com",
      NEXT_PUBLIC_CAPACITOR_APP: "1",
    },
    stdio: "inherit",
    shell: true,
  }
);

const tempOut = join(tempDir, "out");
const projectOut = join(root, "out");
if (existsSync(projectOut)) {
  rmSync(projectOut, { recursive: true, maxRetries: 3, retryDelay: 200 });
}
cpSync(tempOut, projectOut, { recursive: true });
console.log("Copied out/ to project.");

rmSync(tempDir, { recursive: true, maxRetries: 3, retryDelay: 200 });
console.log("iOS build complete. Run npm run cap:sync to update the iOS project.");
