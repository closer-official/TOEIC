/**
 * API を使わず、静的データで default-vocab の各単語に 2〜3 つ目の意味を追加する
 * 使い方: node scripts/enrich-vocab-from-static.js
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(process.cwd(), 'data', 'default-vocab.json');
const ADDITIONAL_PATH = path.join(process.cwd(), 'data', 'vocab-additional-meanings.json');

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const vocab = loadJson(DATA_PATH);
  if (!vocab || !Array.isArray(vocab)) {
    console.error('default-vocab.json を読み込めません');
    process.exit(1);
  }

  const additional = loadJson(ADDITIONAL_PATH);
  if (!additional || typeof additional !== 'object') {
    console.log('vocab-additional-meanings.json がないか空です。スキップします。');
    process.exit(0);
  }

  let updated = 0;
  for (const entry of vocab) {
    const w = (entry.word || '').toLowerCase();
    const extra = additional[w];
    if (!extra || !Array.isArray(extra)) continue;
    const current = entry.meanings || [];
    if (current.length >= 3) continue;
    const added = extra.filter((m) => typeof m === 'string' && m.trim() && !current.includes(m));
    if (added.length === 0) continue;
    entry.meanings = [...current, ...added].slice(0, 3);
    updated++;
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(vocab) + '\n', 'utf8');
  console.log(`追加意味をマージしました: ${updated} 語を更新`);
}

main();
