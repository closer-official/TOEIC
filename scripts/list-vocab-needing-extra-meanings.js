/**
 * 意味が1つのみの語を一覧し、data/vocab-words-needing-extra-meanings.json に書き出す
 * 実行: node scripts/list-vocab-needing-extra-meanings.js
 */
const fs = require('fs');
const path = require('path');

const VOCAB_PATH = path.join(process.cwd(), 'data', 'default-vocab.json');
const OUT_PATH = path.join(process.cwd(), 'data', 'vocab-words-needing-extra-meanings.json');

const vocab = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8'));
const oneOnly = vocab
  .filter((e) => (e.meanings || []).length < 2)
  .map((e) => ({ word: e.word, pos: e.pos || '', meaning: (e.meanings || [])[0] || '' }));

const words = oneOnly.map((e) => e.word);
fs.writeFileSync(OUT_PATH, JSON.stringify(words, null, 2) + '\n', 'utf8');
console.log(`意味1つのみ: ${oneOnly.length} 語`);
console.log(`Wrote ${OUT_PATH}`);
