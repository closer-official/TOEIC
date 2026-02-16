/**
 * Validator Agent: 正解1つ・自然なビジネス英語を100点満点で採点。85未満は破棄して再生成案を返す
 * 環境変数: OPENAI_API_KEY
 * 入力: stdin に JSON 配列（generate-questions の出力形式）
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const VALIDATOR_PROMPT = `You are a TOEIC Part 5 quality checker. For each question, score 0-100 based on:
1) Exactly one correct answer (no ambiguity) — 50 points max
2) Natural business English (idiomatic, professional) — 50 points max

Input: a JSON array of questions. Each has: question, options, correct_index, explanation, category, difficulty, vocab_map.

Output a JSON array with the SAME LENGTH. Each element must be:
{ "score": number 0-100, "pass": true if score >= 85 else false, "reason": "brief reason in Japanese under 40 chars" }

If pass is false, suggest in "reason" what to fix (e.g. "正解が曖昧", "不自然な英語").
Output ONLY the JSON array, no markdown.`;

async function validateWithOpenAI(questionsJson: string): Promise<{ score: number; pass: boolean; reason: string }[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: `${VALIDATOR_PROMPT}\n\nInput:\n${questionsJson}` },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${t}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in OpenAI response');
  const raw = content.replace(/^```json?\s*|\s*```$/g, '').trim();
  return JSON.parse(raw) as { score: number; pass: boolean; reason: string }[];
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const raw = await readStdin();
  const questions = JSON.parse(raw) as unknown[];
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Stdin must be a non-empty JSON array');
  }
  const results = await validateWithOpenAI(JSON.stringify(questions));
  const passed: unknown[] = [];
  const failed: { index: number; score: number; reason: string; q: unknown }[] = [];
  results.forEach((r, i) => {
    if (r.pass && questions[i]) passed.push(questions[i]);
    else failed.push({ index: i, score: r.score, reason: r.reason || '', q: questions[i] });
  });
  process.stdout.write(JSON.stringify({ passed, failed, summary: { total: questions.length, passed: passed.length, failed: failed.length } }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
