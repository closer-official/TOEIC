/**
 * SVG から PWA 用 PNG アイコンを生成
 * 実行: node scripts/generate-pwa-icons.js
 */
const fs = require('fs');
const path = require('path');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('sharp をインストール中...');
    const { execSync } = require('child_process');
    execSync('npm install --save-dev sharp', { stdio: 'inherit' });
    sharp = require('sharp');
  }

  const publicDir = path.join(process.cwd(), 'public');
  const svgPath = path.join(publicDir, 'icon.svg');
  if (!fs.existsSync(svgPath)) {
    console.error('icon.svg が見つかりません');
    process.exit(1);
  }

  const svg = fs.readFileSync(svgPath);
  for (const size of [192, 512]) {
    const outPath = path.join(publicDir, `icon-${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(outPath);
    console.log(`Generated ${outPath}`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
