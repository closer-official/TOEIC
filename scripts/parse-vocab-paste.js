/**
 * 「Word：意味1、意味2」形式のテキストを default-vocab 形式の JSON に変換する
 * 使い方: node scripts/parse-vocab-paste.js [入力ファイル]
 * 入力ファイル省略時は data/vocab-user-paste.txt を読む
 * 出力: data/vocab-user-additions.json
 */

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, '..', 'data', 'vocab-user-paste.txt');
const outputPath = path.join(__dirname, '..', 'data', 'vocab-user-additions.json');

function inferPos(firstMeaning) {
  if (!firstMeaning || typeof firstMeaning !== 'string') return '名';
  const m = firstMeaning.trim();
  if (/する$|れる$|られる$/.test(m)) return '動';
  if (/な$|的な$|の$|い$|た$/.test(m) && !/する$/.test(m)) return '形';
  if (/に$|く$|と$/.test(m) && m.length < 8) return '副';
  if (/者|人|料|書|性|率|金|費|権|法|式|所|業|品|物|力|度|化|的$/.test(m)) return '名';
  return '名';
}

const raw = fs.readFileSync(inputPath, 'utf8');
const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const out = [];
const seen = new Set();

for (const line of lines) {
  if (/^\d+\.\s|^#|^---/.test(line)) continue;
  const match = line.match(/^([^：:]+)[：:]\s*(.+)$/);
  if (!match) continue;
  const word = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
  const meaningsStr = match[2].trim();
  const meanings = meaningsStr.split(/[、,]/).map((m) => m.trim()).filter(Boolean);
  if (!word || meanings.length === 0) continue;
  if (seen.has(word)) continue;
  seen.add(word);
  const pos = inferPos(meanings[0]);
  out.push({ word, pos, meanings });
}

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`Wrote ${out.length} entries to ${outputPath}`);
