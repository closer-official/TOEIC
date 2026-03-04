/**
 * Gen & Validate パイプライン
 * - 2000問未満: 1日200問追加（MODE=daily）
 * - 2000問以上: 週200問追加（MODE=weekly）
 * - 総数が MAX_QUESTIONS_TOTAL に達したら追加を停止（API 料金の上限対策）
 * - 問題文・選択肢に登場し default-vocab に無い単語を、Part 5 上位3意味で自動追加
 * 環境変数: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MODE=daily|weekly
 * 任意: MAX_QUESTIONS_TOTAL（既定 5000。これ以上は追加しない）
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { QuestionRow } from '../src/types/supabase';
import { GENERATOR_PROMPT, VALIDATOR_PROMPT, BATCH_SIZE_QUESTIONS } from './prompts';

type DefaultVocabEntry = { word: string; pos?: string; meanings: string[] };
const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'though', 'after', 'before', 'that', 'which', 'who', 'whom', 'this', 'these', 'those', 'it', 'its', 'they', 'them', 'we', 'our', 'you', 'your', 'he', 'him', 'she', 'her', 'i', 'me', 'my']);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODE = process.env.MODE ?? 'weekly'; // daily | weekly
const QUESTIONS_PER_RUN = 200;
const THRESHOLD = 2000;
/** 総問題数の上限。これ以上は daily/weekly ともに追加しない（API 料金対策） */
const MAX_QUESTIONS_TOTAL = Math.min(10000, Math.max(1000, parseInt(process.env.MAX_QUESTIONS_TOTAL ?? '5000', 10)));
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

async function getQuestionCount(supabase: ReturnType<typeof createClient>): Promise<number> {
  const { count, error } = await supabase.from('questions').select('*', { count: 'exact', head: true });
  if (error) throw new Error(`Count failed: ${error.message}`);
  return count ?? 0;
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
      messages: [{ role: 'user', content: GENERATOR_PROMPT }],
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '';
  const raw = content.replace(/^```json?\s*|\s*```$/g, '').trim();
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed as RawQuestion[] : [];
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
        { role: 'user', content: `${VALIDATOR_PROMPT}\n\n${JSON.stringify(q)}` },
      ],
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, '').trim()) as { score?: number; pass?: boolean };
  return { score: parsed.score ?? 0, pass: parsed.pass ?? false };
}

function toRow(q: RawQuestion): Omit<QuestionRow, 'id' | 'created_at'> {
  const options = Array.isArray(q.options) && q.options.length >= 4
    ? [q.options[0], q.options[1], q.options[2], q.options[3]] as [string, string, string, string]
    : (['', '', '', ''] as [string, string, string, string]);
  const vocab_map = (q.vocab_map ?? {}) as Record<string, [string, string?, string?]>;
  return {
    question: String(q.question ?? ''),
    options,
    correct_index: Math.min(3, Math.max(0, Number(q.correct_index) || 0)),
    explanation: q.explanation ?? null,
    difficulty: (q.difficulty === '500' || q.difficulty === '700' || q.difficulty === '900') ? q.difficulty : '700',
    category: String(q.category ?? 'その他'),
    vocab_map,
  };
}

function extractWordsFromQuestions(questions: RawQuestion[]): Set<string> {
  const words = new Set<string>();
  for (const q of questions) {
    const text = [q.question, ...(q.options ?? [])].join(' ');
    const matches = text.match(/\b[a-zA-Z]+\b/g) ?? [];
    for (const w of matches) {
      const lower = w.toLowerCase();
      if (lower.length >= 2 && !STOP_WORDS.has(lower)) words.add(lower);
    }
  }
  return words;
}

function loadDefaultVocab(): DefaultVocabEntry[] {
  try {
    const path = join(process.cwd(), 'data', 'default-vocab.json');
    const raw = readFileSync(path, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list as DefaultVocabEntry[] : [];
  } catch {
    return [];
  }
}

async function fetchMeaningsForWords(words: string[]): Promise<DefaultVocabEntry[]> {
  if (words.length === 0) return [];
  const prompt = `TOEIC Part 5 でよく使われる意味を、次の英単語それぞれについて日本語で最大3つ（使用頻度順）教えてください。
品詞は 動・名・形・副・接・前 のいずれか1つを付けてください。
出力は JSON 配列のみ。各要素: { "word": "英単語", "pos": "動", "meanings": ["意味1","意味2","意味3"] }
英単語リスト: ${JSON.stringify(words)}`;
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
  if (!res.ok) return [];
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '[]';
  const raw = content.replace(/^```json?\s*|\s*```$/g, '').trim();
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.filter((e: unknown) => e && typeof e === 'object' && 'word' in e && typeof (e as { word: unknown }).word === 'string').map((e: { word: string; pos?: string; meanings?: string[] }) => ({
      word: String(e.word).toLowerCase(),
      pos: typeof e.pos === 'string' ? e.pos : undefined,
      meanings: Array.isArray(e.meanings) ? e.meanings.slice(0, 3).filter((m): m is string => typeof m === 'string') : [],
    }));
  } catch {
    return [];
  }
}

function mergeDefaultVocab(inserted: DefaultVocabEntry[]) {
  if (inserted.length === 0) return;
  const path = join(process.cwd(), 'data', 'default-vocab.json');
  const existing = loadDefaultVocab();
  const existingWords = new Set(existing.map((e) => e.word.toLowerCase()));
  const toAdd = inserted.filter((e) => e.word && !existingWords.has(e.word.toLowerCase()));
  if (toAdd.length === 0) return;
  const merged = [...existing, ...toAdd];
  writeFileSync(path, JSON.stringify(merged, null, 0) + '\n', 'utf8');
  console.log(`Default vocab: added ${toAdd.length} new entries (${toAdd.map((e) => e.word).join(', ')})`);
}

async function main() {
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY required');
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const count = await getQuestionCount(supabase);

  if (count >= MAX_QUESTIONS_TOTAL) {
    console.log(`Count ${count} >= MAX_QUESTIONS_TOTAL (${MAX_QUESTIONS_TOTAL}). Stopping to cap API cost.`);
    process.exit(0);
  }

  if (MODE === 'daily') {
    if (count >= THRESHOLD) {
      console.log(`Count ${count} >= ${THRESHOLD}. Daily run skips.`);
      process.exit(0);
    }
  } else {
    if (count < THRESHOLD) {
      console.log(`Count ${count} < ${THRESHOLD}. Weekly run skips (use daily until 2000).`);
      process.exit(0);
    }
  }

  let totalInserted = 0;
  const batchesNeeded = Math.ceil(QUESTIONS_PER_RUN / BATCH_SIZE_QUESTIONS);

  for (let b = 0; b < batchesNeeded && totalInserted < QUESTIONS_PER_RUN; b++) {
    const batch = await generateBatch();
    const toValidate = batch.slice(0, BATCH_SIZE_QUESTIONS);
    const passed: RawQuestion[] = [];
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts && passed.length < toValidate.length; attempt++) {
      for (const q of toValidate) {
        if (passed.length >= QUESTIONS_PER_RUN - totalInserted) break;
        try {
          const { pass } = await validateOne(q);
          if (pass) passed.push(q);
        } catch (e) {
          console.warn('Validation error', e);
        }
      }
    }

    const toInsert = passed.slice(0, QUESTIONS_PER_RUN - totalInserted).map(toRow);
    if (toInsert.length > 0) {
      const { error } = await supabase.from('questions').insert(toInsert);
      if (error) {
        console.error('Supabase insert error', error);
        process.exit(1);
      }
      totalInserted += toInsert.length;
      console.log(`Inserted ${toInsert.length} (total this run: ${totalInserted})`);

      // 問題文・選択肢に登場し default-vocab に無い単語を上位3意味で自動追加
      const wordsInBatch = extractWordsFromQuestions(passed);
      const defaultList = loadDefaultVocab();
      const existingWords = new Set(defaultList.map((e) => e.word.toLowerCase()));
      const missing = [...wordsInBatch].filter((w) => !existingWords.has(w));
      if (missing.length > 0) {
        try {
          const newEntries = await fetchMeaningsForWords(missing);
          mergeDefaultVocab(newEntries);
        } catch (e) {
          console.warn('Default vocab merge failed', e);
        }
      }
    }
  }

  console.log(`Done. Inserted ${totalInserted} questions. Total in DB: ${count + totalInserted}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
