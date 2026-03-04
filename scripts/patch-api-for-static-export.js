/**
 * 静的エクスポート（build:ios）用に全 API ルートに以下を追加する:
 * - export const dynamic = 'force-static';
 * - 各 export async function GET/POST/... の先頭で BUILD_IOS のとき 404 を返す
 */
const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

function glob(dir) {
  const results = [];
  const entries = require("fs").readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...glob(full));
    } else if (e.isFile() && e.name === "route.ts") {
      results.push(full);
    }
  }
  return results;
}

const GUARD =
  "  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });";
const DYNAMIC = "export const dynamic = 'force-static';";

function patchFile(filePath) {
  let content = readFileSync(filePath, "utf8");
  if (content.includes("export const dynamic = 'force-static'")) {
    return false;
  }

  const lastImportMatch = content.match(/((?:import\s[\s\S]*?;\s*\n)+)/g);
  let insertDynamicAt = 0;
  if (lastImportMatch) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    insertDynamicAt = content.indexOf(lastImport) + lastImport.length;
  } else {
    const firstBreak = content.indexOf("\n\n");
    if (firstBreak !== -1) insertDynamicAt = firstBreak + 2;
  }
  content =
    content.slice(0, insertDynamicAt) +
    "\n" +
    DYNAMIC +
    "\n\n" +
    content.slice(insertDynamicAt);

  if (content.includes("process.env.BUILD_IOS === '1'")) {
    return true;
  }
  content = content.replace(
    /(export\s+async\s+function\s+(?:GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{)\s*\n/g,
    `$1\n${GUARD}\n`
  );

  writeFileSync(filePath, content, "utf8");
  return true;
}

const apiDir = join(__dirname, "..", "src", "app", "api");
const files = glob(apiDir);
let patched = 0;
for (const f of files) {
  if (patchFile(f)) patched++;
}
console.log(`Patched ${patched} API route files for static export.`);
