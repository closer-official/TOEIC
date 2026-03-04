/**
 * 意味が1つしかない単語に、TOEIC・ビジネスでよく使う2つ目・3つ目の意味を追加する
 * 使い方: OPENAI_API_KEY=xxx node scripts/enrich-vocab-meanings.js
 * 40語ずつバッチでAPIを呼び、default-vocab.json を更新する（既存の意味は維持、最大3つまで）
 */

const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BATCH_SIZE = 40;
const DATA_PATH = path.join(process.cwd(), 'data', 'default-vocab.json');

function loadVocab() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

async function enrichBatch(entries) {
  const list = entries.map((e) => `"${e.word}"（${e.pos}）: ${(e.meanings || []).join('、')}`).join('\n');
  const prompt = `次の英単語はTOEIC Part 5用の単語リストです。各単語には既に日本語意味が付いています。
TOEIC・ビジネス英語でよく使う「追加の」意味を日本語で1〜2個、使用頻度の高い順に挙げてください。既存の意味は含めず、追加分だけ。
出力はJSON配列のみ。各要素: {"word": "英単語", "meanings": ["追加意味1", "追加意味2"]}  （1つだけなら1つで可）

単語リスト:
${list}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '[]';
  const raw = content.replace(/^```json?\s*|\s*```$/g, '').trim();
  return JSON.parse(raw);
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY を設定してください');
    process.exit(1);
  }
  const vocab = loadVocab();
  const toEnrich = vocab.filter((e) => !e.meanings || e.meanings.length < 3);
  console.log(`意味が3未満の単語: ${toEnrich.length} 語。バッチで追加します。`);

  const byWord = new Map(vocab.map((e) => [e.word.toLowerCase(), e]));
  let done = 0;
  for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
    const batch = toEnrich.slice(i, i + BATCH_SIZE);
    try {
      const result = await enrichBatch(batch);
      for (const r of result) {
        if (!r.word) continue;
        const w = r.word.toLowerCase();
        const existing = byWord.get(w);
        if (!existing) continue;
        const current = existing.meanings || [];
        const added = (Array.isArray(r.meanings) ? r.meanings : []).filter((m) => typeof m === 'string' && !current.includes(m));
        existing.meanings = [...current, ...added].slice(0, 3);
      }
      done += batch.length;
      console.log(`  ${done} / ${toEnrich.length}`);
    } catch (err) {
      console.warn(`Batch at ${i} failed:`, err.message);
    }
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(vocab) + '\n', 'utf8');
  const withMultiple = vocab.filter((e) => e.meanings && e.meanings.length >= 2).length;
  console.log(`完了。2つ以上の意味を持つ単語: ${withMultiple} 語`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
