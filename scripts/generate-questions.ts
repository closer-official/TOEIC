/**
 * Generator Agent: 本質的な TOEIC Part 5 出題用プロンプトで JSON 生成
 * 環境変数: OPENAI_API_KEY
 */

import { GENERATOR_PROMPT, BATCH_SIZE_QUESTIONS } from './prompts';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function generateWithOpenAI(): Promise<unknown[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: GENERATOR_PROMPT }],
      temperature: 0.7,
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
  return JSON.parse(raw) as unknown[];
}

async function main() {
  const questions = await generateWithOpenAI();
  if (!Array.isArray(questions) || questions.length < BATCH_SIZE_QUESTIONS) {
    throw new Error(`Expected array of ${BATCH_SIZE_QUESTIONS}, got ${questions?.length ?? 0}`);
  }
  process.stdout.write(JSON.stringify(questions.slice(0, BATCH_SIZE_QUESTIONS), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
