/**
 * data/vocab-user-additions.json を data/default-vocab.json にマージする
 * 既存の単語は上書きせず、未登録の単語のみ追加する
 * 使い方: node scripts/merge-user-vocab.js
 */

const fs = require('fs');
const path = require('path');

const defaultPath = path.join(process.cwd(), 'data', 'default-vocab.json');
const additionsPath = path.join(process.cwd(), 'data', 'vocab-user-additions.json');

const existing = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
const seen = new Set(existing.map((e) => e.word.toLowerCase()));

const additions = JSON.parse(fs.readFileSync(additionsPath, 'utf8'));
let added = 0;
for (const entry of additions) {
  const w = (entry.word || '').toLowerCase().trim();
  if (!w || seen.has(w)) continue;
  existing.push({
    word: w,
    pos: entry.pos || '名',
    meanings: Array.isArray(entry.meanings) ? entry.meanings : [entry.word],
  });
  seen.add(w);
  added++;
}

fs.writeFileSync(defaultPath, JSON.stringify(existing) + '\n', 'utf8');
console.log(`Merged: ${added} new entries. Total: ${existing.length}`);
