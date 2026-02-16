/**
 * Gen & Validate パイプライン: 生成 → 検証 → 85未満を破棄し、足りない分だけ再生成してマージ
 * 環境変数: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 出力: マージ後の50問を Supabase questions に upsert（週次用）
 */

import { createClient } from '@supabase/supabase-js';
import type { QuestionRow } from '../src/types/supabase';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_COUNT = 50;
const MIN_SCORE = 85;

interface RawQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  category: string;
  difficulty: string;
  vocab_map?: Record<string, string[]>;
}

async function generateBatch(): Promise<RawQuestion[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Generate exactly ${TARGET_COUNT} TOEIC Part 5 questions as a JSON array. 50% vocabulary, 50% grammar. Difficulty evenly 500/700/900. Business topics. Each item: question (use ____ for blank), options (4 strings), correct_index (0-3), explanation (Japanese, short), category (品詞|時制|前置詞|語彙|接続詞|代名詞|その他), difficulty ("500"|"700"|"900"), vocab_map (object: every word in question/options -> up to 3 Japanese meanings). Output ONLY the JSON array.`,
        },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '';
  const raw = content.replace(/^```json?\s*|\s*```$/g, '').trim();
  return JSON.parse(raw) as RawQuestion[];
}

async function validateOne(q: RawQuestion): Promise<{ score: number; pass: boolean }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Score this TOEIC question 0-100: (1) Exactly one correct answer, 50pts. (2) Natural business English, 50pts. Reply with ONLY a JSON object: {"score": number, "pass": true if score>=85 else false}\n\n${JSON.stringify(q)}`,
        },
      ],
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content.replace(/^```json?\s*|\s*```$/g, '').trim()) as { score?: number; pass?: boolean };
  return { score: parsed.score ?? 0, pass: parsed.pass ?? false };
}

function toRow(q: RawQuestion): Omit<QuestionRow, 'id' | 'created_at'> {
  const options = Array.isArray(q.options) && q.options.length === 4
    ? (q.options as [string, string, string, string])
    : (['', '', '', ''] as [string, string, string, string]);
  const vocab_map = (q.vocab_map ?? {}) as Record<string, [string, string?, string?]>;
  return {
    question: String(q.question ?? ''),
    options,
    correct_index: Number(q.correct_index) >= 0 && Number(q.correct_index) <= 3 ? Number(q.correct_index) : 0,
    explanation: q.explanation ?? null,
    difficulty: (q.difficulty === '500' || q.difficulty === '700' || q.difficulty === '900') ? q.difficulty : '700',
    category: String(q.category ?? 'その他'),
    vocab_map,
  };
}

async function main() {
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY required');
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let passed: RawQuestion[] = [];
  let attempts = 0;
  const maxAttempts = 3;

  while (passed.length < TARGET_COUNT && attempts < maxAttempts) {
    const batch = await generateBatch();
    const toValidate = batch.slice(0, TARGET_COUNT - passed.length + 10);
    for (const q of toValidate) {
      if (passed.length >= TARGET_COUNT) break;
      try {
        const { pass } = await validateOne(q);
        if (pass) passed.push(q);
      } catch (e) {
        console.warn('Validation error', e);
      }
    }
    attempts++;
  }

  const toInsert = passed.slice(0, TARGET_COUNT).map(toRow);
  if (toInsert.length === 0) {
    console.error('No questions passed validation');
    process.exit(1);
  }

  const { error } = await supabase.from('questions').insert(toInsert);
  if (error) {
    console.error('Supabase insert error', error);
    process.exit(1);
  }
  console.log(`Inserted ${toInsert.length} questions.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
