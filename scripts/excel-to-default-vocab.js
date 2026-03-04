/**
 * data/ 内の Excel（.xlsx）を読み、default-vocab.json 形式で出力する。
 * 使い方: node scripts/excel-to-default-vocab.js [Excelファイル] [出力JSONパス]
 * 省略時: data/基礎英単語_TOEIC最適化_完成版.xlsx → data/default-vocab.json
 * TSL 用: node scripts/excel-to-default-vocab.js data/TSL.xlsx data/tsl-vocab.json
 *
 * 想定列名（いずれか）:
 * - 単語: 単語 / word / 英単語 / Word
 * - 品詞: 品詞 / pos / POS
 * - 意味: 意味 / 訳 / meaning / translation / translation_1, translation_2 … / 意味1, 意味2 …
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
const defaultExcel = path.join(dataDir, '基礎英単語_TOEIC最適化_完成版.xlsx');
const defaultOutput = path.join(dataDir, 'default-vocab.json');

const excelPath = process.argv[2] || defaultExcel;
const outputPath = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : defaultOutput;

if (!fs.existsSync(excelPath)) {
  console.error('ファイルが見つかりません:', excelPath);
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
const colIndex = { word: -1, pos: -1, meaningKeys: [] };

for (let i = 0; i < headers.length; i++) {
  const n = normalizeHeader(headers[i]);
  if (n === '単語' || n === 'word' || n === '英単語') colIndex.word = i;
  else if (n === '品詞' || n === 'pos') colIndex.pos = i;
  else if (/^意味\d*$/.test(n) || n === '訳' || n === 'meaning' || n === 'translation' || n === '日本語' || /^translation_\d+$/.test(n)) {
    colIndex.meaningKeys.push(i);
  }
}

// 意味列がまだ無い場合、品詞の次や「1」「2」などの列を探す
if (colIndex.meaningKeys.length === 0) {
  for (let i = 0; i < headers.length; i++) {
    if (i === colIndex.word || i === colIndex.pos) continue;
    const h = headers[i];
    if (h != null && String(h).trim() !== '') colIndex.meaningKeys.push(i);
  }
}

if (colIndex.word < 0) {
  console.error('単語列が見つかりません。列名に 単語 / word / 英単語 のいずれかを含めてください。');
  process.exit(1);
}
if (colIndex.meaningKeys.length === 0) {
  console.error('意味列が見つかりません。');
  process.exit(1);
}

const out = [];
const seen = new Set();

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!Array.isArray(row)) continue;
  const wordRaw = row[colIndex.word];
  const word = String(wordRaw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!word) continue;

  const meanings = [];
  for (const ki of colIndex.meaningKeys) {
    const v = row[ki];
    if (v != null && String(v).trim() !== '') {
      const m = String(v).trim();
      if (m && !meanings.includes(m)) meanings.push(m);
    }
  }
  if (meanings.length === 0) continue;
  if (seen.has(word)) continue;
  seen.add(word);

  out.push({ word, meanings });
}

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`${out.length} 件を ${outputPath} に書き出しました。`);
process.exit(0);
