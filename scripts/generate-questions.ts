/**
 * Generator Agent: 語彙50% / 文法50%、難易度均等、ビジネストピック、Vocab Map 付きで JSON 生成
 * 環境変数: OPENAI_API_KEY
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NUM_QUESTIONS = 50;

const GENERATOR_PROMPT = `You are a TOEIC Part 5 question writer. Generate exactly ${NUM_QUESTIONS} questions as a JSON array.

Requirements:
- 50% vocabulary (word meaning), 50% grammar (part of speech, tense, preposition, etc.).
- Difficulty: evenly split into 500 / 700 / 900 (approx 17 each).
- Topics: business, logistics, HR, finance, marketing, office, contracts.
- Each item must have:
  - question: short sentence with a single blank written as ____ (four underscores)
  - options: array of exactly 4 strings (A,B,C,D). For vocab: same-root different parts of speech to trick advanced learners. For grammar: plausible distractors.
  - correct_index: 0 for A, 1 for B, 2 for C, 3 for D
  - explanation: why it's correct, under 30 chars in Japanese
  - category: one of "品詞","時制","前置詞","語彙","接続詞","代名詞","その他"
  - difficulty: "500" | "700" | "900"
  - vocab_map: object. For EVERY word that appears in "question" or in any of "options", add an entry: word (lowercase) -> array of up to 3 TOEIC-frequent meanings in Japanese. Example: {"affect": ["影響する","〜に作用する","感動させる"], "directly": ["直接に","すぐに","率直に"]}. Include all content words (nouns, verbs, adjectives, adverbs). Do not skip any word from question or options.

Output ONLY a single JSON array, no markdown, no explanation.`;

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
  if (!Array.isArray(questions) || questions.length < NUM_QUESTIONS) {
    throw new Error(`Expected array of ${NUM_QUESTIONS}, got ${questions?.length ?? 0}`);
  }
  process.stdout.write(JSON.stringify(questions.slice(0, NUM_QUESTIONS), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
