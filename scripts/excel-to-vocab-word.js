/**
 * 単語→単語用: Excel（wordstowords.xlsx）を読み、data/vocab-word.json 形式で出力する。
 * 列: 単語, 品詞, 意味（＝英同義語）, ダミー1〜5
 * 単語モード（vocab.json）とは別ファイル・別取り込みで混在しない。
 *
 * 使い方:
 *   node scripts/excel-to-vocab-word.js [Excelファイル] [出力JSONパス]
 * 省略時: data/wordstowords.xlsx → data/vocab-word.json
 */

const fs = require('fs');
const path = require('path');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.error('xlsx をインストールしてください: npm install xlsx --save-dev');
  process.exit(1);
}

const dataDir = path.join(__dirname, '..', 'data');
const defaultExcel = path.join(dataDir, 'wordstowords.xlsx');
const defaultOutput = path.join(dataDir, 'vocab-word.json');

const excelPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultExcel;
const outputPath = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : defaultOutput;

if (!fs.existsSync(excelPath)) {
  console.error('ファイルが見つかりません:', excelPath);
  console.error('例: node scripts/excel-to-vocab-word.js data/wordstowords.xlsx');
  process.exit(1);
}

function normalizeHeader(str) {
  if (str == null) return '';
  return String(str).trim().toLowerCase().replace(/\s+/g, ' ');
}

const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

if (!rows.length) {
  console.error('シートにデータがありません');
  process.exit(1);
}

const headers = rows[0].map((h) => String(h ?? '').trim());
const col = { word: -1, pos: -1, meaning: -1, dummies: [] };

for (let i = 0; i < headers.length; i++) {
  const n = normalizeHeader(headers[i]);
  if (n === '単語' || n === 'word' || n === '英単語') col.word = i;
  else if (n === '品詞' || n === 'pos') col.pos = i;
  else if (n === '意味' || n === '訳' || n === 'meaning') col.meaning = i;
  else if (n === 'ダミー1' || n === 'dummy1') col.dummies[0] = i;
  else if (n === 'ダミー2' || n === 'dummy2') col.dummies[1] = i;
  else if (n === 'ダミー3' || n === 'dummy3') col.dummies[2] = i;
  else if (n === 'ダミー4' || n === 'dummy4') col.dummies[3] = i;
  else if (n === 'ダミー5' || n === 'dummy5') col.dummies[4] = i;
}

if (col.word < 0) {
  console.error('単語列が見つかりません。列名に 単語 / word / 英単語 のいずれかを含めてください。');
  process.exit(1);
}
if (col.meaning < 0) {
  console.error('意味列が見つかりません。列名に 意味 / 訳 / meaning のいずれかを含めてください。');
  process.exit(1);
}

if (col.dummies.filter((x) => x != null).length < 5) {
  col.dummies = [];
  const meaningNext = col.meaning + 1;
  for (let i = 0; i < 5; i++) {
    const idx = meaningNext + i;
    if (idx < headers.length) col.dummies.push(idx);
    else col.dummies.push(-1);
  }
}
while (col.dummies.length < 5) col.dummies.push(-1);

const out = [];
let skipEmptyWord = 0;
let skipEmptyMeaning = 0;

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!Array.isArray(row)) continue;
  const wordRaw = row[col.word];
  const word = String(wordRaw ?? '').trim().replace(/\s+/g, ' ');
  if (!word) {
    skipEmptyWord++;
    continue;
  }

  const meaning = String(row[col.meaning] ?? '').trim();
  if (!meaning) {
    skipEmptyMeaning++;
    continue;
  }

  const pos = col.pos >= 0 ? String(row[col.pos] ?? '').trim() : '';
  const dummies = col.dummies.slice(0, 5).map((i) => (i >= 0 && row[i] != null ? String(row[i]).trim() : ''));

  out.push({
    word,
    pos: pos || '名',
    meaning,
    dummies: dummies.length >= 5 ? dummies : [...dummies, ...Array(5 - dummies.length).fill('')],
  });
}

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`[単語→単語] ${out.length} 件を ${outputPath} に書き出しました。`);
const totalSkipped = skipEmptyWord + skipEmptyMeaning;
if (totalSkipped > 0) {
  console.log(`スキップ: 単語なし ${skipEmptyWord} 件, 意味なし ${skipEmptyMeaning} 件（計 ${totalSkipped} 件）`);
}
process.exit(0);
