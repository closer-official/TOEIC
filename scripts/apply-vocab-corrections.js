/**
 * default-vocab.json に品詞修正・意味修正・不適合語削除を一括適用する
 * 実行: node scripts/apply-vocab-corrections.js
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(process.cwd(), 'data', 'default-vocab.json');
const list = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 1. 指定どおりに上書きするエントリ
const exactReplacements = new Map([
  ['feature', { word: 'feature', pos: '動', meanings: ['～を特徴とする', '～を呼び物にする', '特集する'] }],
  ['hint', { word: 'hint', pos: '名', meanings: ['兆候', '気配', 'ヒント'] }],
  ['entity', { word: 'entity', pos: '名', meanings: ['組織', '法人', '団体'] }],
  ['restrain', { word: 'restrain', pos: '動', meanings: ['抑える', '制止する'] }],
  ['adaptable', { word: 'adaptable', pos: '形', meanings: ['適応できる', '順応性のある'] }],
  ['remarkably', { word: 'remarkably', pos: '副', meanings: ['著しく', '目立って'] }],
  ['on behalf of', { word: 'on behalf of', pos: '前', meanings: ['～を代表して', '～に代わって'] }],
  ['address', { word: 'address', pos: '動', meanings: ['対処する', '演説する', '扱う'] }],
  // 句動詞・接続表現の修正（ユーザー指定）
  ['regardless of', { word: 'regardless of', pos: '前', meanings: ['～にかかわらず', '～に関係なく'] }],
  ['in terms of', { word: 'in terms of', pos: '前', meanings: ['～の点では', '～の観点から'] }],
  ['thanks to', { word: 'thanks to', pos: '前', meanings: ['～のおかげで', '～のせいで'] }],
  ['by means of', { word: 'by means of', pos: '前', meanings: ['～によって', '～を用いて'] }],
  ['by way of', { word: 'by way of', pos: '前', meanings: ['～経由で', '～の方法で'] }],
  ['in addition to', { word: 'in addition to', pos: '前', meanings: ['～に加えて', 'そのほかに'] }],
  ['as a result of', { word: 'as a result of', pos: '前', meanings: ['～の結果として', '～を受けて'] }],
  ['on the verge of', { word: 'on the verge of', pos: '前', meanings: ['～の寸前で', '～しようとして'] }],
  ['at the expense of', { word: 'at the expense of', pos: '前', meanings: ['～を犠牲にして', '～の費用で'] }],
  ['for the purpose of', { word: 'for the purpose of', pos: '前', meanings: ['～の目的で', '～のために'] }],
  ['with a view to', { word: 'with a view to', pos: '前', meanings: ['～する目的で', '～を視野に入れて'] }],
  ['as a rule', { word: 'as a rule', pos: '副', meanings: ['概して', '普通は'] }],
  ['on average', { word: 'on average', pos: '副', meanings: ['平均して', '概して'] }],
  ['at first', { word: 'at first', pos: '副', meanings: ['最初は', '当初は'] }],
  ['at least', { word: 'at least', pos: '副', meanings: ['少なくとも', '最低でも'] }],
  ['at most', { word: 'at most', pos: '副', meanings: ['多くとも', 'せいぜい'] }],
  ['for now', { word: 'for now', pos: '副', meanings: ['今のところ', '差し当たり'] }],
  ['in time', { word: 'in time', pos: '副', meanings: ['間に合って', 'やがて'] }],
  ['once in a while', { word: 'once in a while', pos: '副', meanings: ['時々', 'たまに'] }],
  ['every now and then', { word: 'every now and then', pos: '副', meanings: ['時々', '時折'] }],
  ['so far', { word: 'so far', pos: '副', meanings: ['これまでのところ', '今までは'] }],
  ['up to now', { word: 'up to now', pos: '副', meanings: ['今に至るまで', 'これまでは'] }],
  ['as of now', { word: 'as of now', pos: '副', meanings: ['現在のところ', '今現在は'] }],
  ['out of stock', { word: 'out of stock', pos: '形', meanings: ['在庫切れで', '品切れの'] }],
  ['in stock', { word: 'in stock', pos: '形', meanings: ['在庫あり', '在庫があって'] }],
  ['on sale', { word: 'on sale', pos: '形', meanings: ['特売中で', '売り出し中の'] }],
  ['for sale', { word: 'for sale', pos: '形', meanings: ['売り物で', '販売用の'] }],
  ['in advance', { word: 'in advance', pos: '副', meanings: ['前もって', 'あらかじめ'] }],
  ['behind schedule', { word: 'behind schedule', pos: '副', meanings: ['予定より遅れて', '遅延して'] }],
  ['out of order', { word: 'out of order', pos: '形', meanings: ['故障して', '不調で'] }],
  ['in order', { word: 'in order', pos: '形', meanings: ['順調で', '整って', '適切な'] }],
  ['therefore', { word: 'therefore', pos: '副', meanings: ['したがって', 'それゆえに'] }],
  ['moreover', { word: 'moreover', pos: '副', meanings: ['その上', 'さらに'] }],
  ['nevertheless', { word: 'nevertheless', pos: '副', meanings: ['それにもかかわらず', 'それでも'] }],
  ['furthermore', { word: 'furthermore', pos: '副', meanings: ['さらに', 'そのうえ'] }],
  ['whereas', { word: 'whereas', pos: '接', meanings: ['その一方で', '～であるのに'] }],
  ['provided', { word: 'provided that', pos: '接', meanings: ['～という条件で', 'もし～ならば'] }],
  ['provided that', { word: 'provided that', pos: '接', meanings: ['～という条件で', 'もし～ならば'] }],
  ['in spite of', { word: 'in spite of', pos: '前', meanings: ['～にもかかわらず'] }],
  ['in lieu of', { word: 'in lieu of', pos: '前', meanings: ['～の代わりに'] }],
  ['in light of', { word: 'in light of', pos: '前', meanings: ['～を考慮して', '～に照らして'] }],
]);

// 2. 品詞のみ修正
const posOnly = {
  discerning: '形', assertive: '形', articulate: '形', charismatic: '形',
  vibrant: '形', intriguing: '形', admirable: '形',
  noticeably: '副', slightly: '副', quite: '副', rather: '副', somewhat: '副', ideally: '副',
  respecting: '前', 'as for': '前', still: '副', 'consist of': '動',
  'in charge of': '前', 'in accordance with': '前', 'with respect to': '前',
  'in relation to': '前', regarding: '前', concerning: '前',
};

// 3. 意味のみ修正
const meaningReplacements = {
  adversely: ['逆に', '不利に', '悪影響を及ぼして'],
  behalf: ['（on behalf ofの形で）～に代わって', '～を代表して'],
  markup: ['（原価への）上乗せ額', '粗利益'],
  markdown: ['価格引き下げ', '値下げ'],
};
// render: 既存の意味に「（サービスなどを）提供する」を追加
function fixRenderMeanings(meanings) {
  if (!Array.isArray(meanings)) return ['～の状態にする', '（サービスなどを）提供する'];
  const has = meanings.some((m) => /提供|供給/.test(m));
  if (has) return meanings;
  const out = [...meanings, '（サービスなどを）提供する'];
  return out.slice(0, 5);
}

// 4. 削除する単語（behalf は on behalf of に置換のため削除）
const toDelete = new Set([
  'invigilate', 'itinerate',
  'brainlessly', 'boyishly', 'bloodily', 'bonily', 'brashly', 'braidly',
  'beseechingly', 'bestially', 'anarchically', 'ancestrally',
  'behalf',  // on behalf of に置換
].map((w) => w.toLowerCase()));

// 5. 新規追加（既存に無い場合に追加）
const toAdd = [
  { word: 'on behalf of', pos: '前', meanings: ['～を代表して', '～に代わって'] },
  { word: 'regardless of', pos: '前', meanings: ['～にかかわらず', '～に関係なく'] },
  { word: 'in terms of', pos: '前', meanings: ['～の点では', '～の観点から'] },
  { word: 'thanks to', pos: '前', meanings: ['～のおかげで', '～のせいで'] },
  { word: 'by means of', pos: '前', meanings: ['～によって', '～を用いて'] },
  { word: 'by way of', pos: '前', meanings: ['～経由で', '～の方法で'] },
  { word: 'in addition to', pos: '前', meanings: ['～に加えて', 'そのほかに'] },
  { word: 'as a result of', pos: '前', meanings: ['～の結果として', '～を受けて'] },
  { word: 'on the verge of', pos: '前', meanings: ['～の寸前で', '～しようとして'] },
  { word: 'at the expense of', pos: '前', meanings: ['～を犠牲にして', '～の費用で'] },
  { word: 'for the purpose of', pos: '前', meanings: ['～の目的で', '～のために'] },
  { word: 'with a view to', pos: '前', meanings: ['～する目的で', '～を視野に入れて'] },
  { word: 'as a rule', pos: '副', meanings: ['概して', '普通は'] },
  { word: 'on average', pos: '副', meanings: ['平均して', '概して'] },
  { word: 'at first', pos: '副', meanings: ['最初は', '当初は'] },
  { word: 'at least', pos: '副', meanings: ['少なくとも', '最低でも'] },
  { word: 'at most', pos: '副', meanings: ['多くとも', 'せいぜい'] },
  { word: 'for now', pos: '副', meanings: ['今のところ', '差し当たり'] },
  { word: 'in time', pos: '副', meanings: ['間に合って', 'やがて'] },
  { word: 'once in a while', pos: '副', meanings: ['時々', 'たまに'] },
  { word: 'every now and then', pos: '副', meanings: ['時々', '時折'] },
  { word: 'so far', pos: '副', meanings: ['これまでのところ', '今までは'] },
  { word: 'up to now', pos: '副', meanings: ['今に至るまで', 'これまでは'] },
  { word: 'as of now', pos: '副', meanings: ['現在のところ', '今現在は'] },
  { word: 'out of stock', pos: '形', meanings: ['在庫切れで', '品切れの'] },
  { word: 'in stock', pos: '形', meanings: ['在庫あり', '在庫があって'] },
  { word: 'on sale', pos: '形', meanings: ['特売中で', '売り出し中の'] },
  { word: 'for sale', pos: '形', meanings: ['売り物で', '販売用の'] },
  { word: 'in advance', pos: '副', meanings: ['前もって', 'あらかじめ'] },
  { word: 'behind schedule', pos: '副', meanings: ['予定より遅れて', '遅延して'] },
  { word: 'out of order', pos: '形', meanings: ['故障して', '不調で'] },
  { word: 'in order', pos: '形', meanings: ['順調で', '整って', '適切な'] },
  { word: 'therefore', pos: '副', meanings: ['したがって', 'それゆえに'] },
  { word: 'moreover', pos: '副', meanings: ['その上', 'さらに'] },
  { word: 'nevertheless', pos: '副', meanings: ['それにもかかわらず', 'それでも'] },
  { word: 'furthermore', pos: '副', meanings: ['さらに', 'そのうえ'] },
  { word: 'whereas', pos: '接', meanings: ['その一方で', '～であるのに'] },
  { word: 'provided that', pos: '接', meanings: ['～という条件で', 'もし～ならば'] },
  { word: 'in spite of', pos: '前', meanings: ['～にもかかわらず'] },
  { word: 'in lieu of', pos: '前', meanings: ['～の代わりに'] },
  { word: 'in light of', pos: '前', meanings: ['～を考慮して', '～に照らして'] },
];

const seen = new Set();
const out = [];
let replaced = 0;
let deleted = 0;
let added = 0;

for (const entry of list) {
  const w = (entry.word || '').toLowerCase().trim();
  if (toDelete.has(w)) {
    deleted++;
    continue;
  }
  if (exactReplacements.has(w)) {
    const rep = exactReplacements.get(w);
    out.push(rep);
    seen.add((rep.word || '').toLowerCase().trim());
    replaced++;
    continue;
  }
  const next = { ...entry, word: entry.word, pos: entry.pos, meanings: [...(entry.meanings || [])] };
  if (posOnly[w] !== undefined) next.pos = posOnly[w];
  if (meaningReplacements[w] !== undefined) next.meanings = meaningReplacements[w];
  if (w === 'render') next.meanings = fixRenderMeanings(entry.meanings);
  out.push(next);
  seen.add(w);
}

// 新規追加（既存に無いもののみ）
for (const add of toAdd) {
  const key = (add.word || '').toLowerCase().trim();
  if (!seen.has(key)) {
    out.push(add);
    seen.add(key);
    added++;
  }
}

// 重複除去（同一 word は最後のものを採用）
const byWord = new Map();
for (const e of out) {
  const k = (e.word || '').toLowerCase().trim();
  byWord.set(k, e);
}
const final = [...byWord.values()];

fs.writeFileSync(dataPath, JSON.stringify(final) + '\n', 'utf8');
console.log(`Done. Replaced: ${replaced}, Deleted: ${deleted}, Added: ${added}, Total: ${final.length}`);
console.log('Deleted words:', [...toDelete].join(', '));
