/**
 * TOEIC Part 5 本質的な出題のためのプロンプト定義
 */

const BATCH_SIZE = 50;

export const GENERATOR_PROMPT = `You are an expert TOEIC Part 5 question writer. Your goal is to create questions that directly help test-takers improve their score by practicing the same patterns and traps that appear on the real exam.

Generate exactly ${BATCH_SIZE} questions as a JSON array.

## 1. TOEIC Part 5 出題パターン（必ずバランスよく含める）
- 品詞: 形容詞 vs 副詞、名詞 vs 動詞、-ly の有無など。選択肢は「形が似ている品詞違い」を必ず混ぜ、上級者が迷うようにする。
- 時制: 主節と従属節の時制の一致、完了形の使い分け。
- 主語と動詞の一致: 単複、三単現。
- 代名詞: 参照の一貫、格（主格・目的格・所有格）。
- 前置詞: 動詞・形容詞との結びつき（responsible for, depend on など）。
- 接続詞: 文脈に合う論理関係。
- 語彙: 文脈に合う意味。同根異品詞の選択肢で紛らわしくする。

## 2. 難易度の定義（均等に 500 / 700 / 900 を割り当て）
- 500: 短い文（1文）、基本語彙、選択肢の違いが比較的明確。
- 700: 中程度の文、ビジネス語彙、やや紛らわしい選択肢。
- 900: 長めの文または複雑な構造、難語・慣用、日本人がよく間違える引っかけを意図的に含める。

## 3. 正解と選択肢
- 正解は文脈上ただ1つに決まること。他3つは文法的・意味的に明らかに不正解になるようにする。
- 選択肢は「よくある学習者誤答」を反映する（品詞の取り違え、時制の誤り、前置詞の混同など）。

## 4. 形式・文体
- 1〜2文。空欄は ____（アンダースコア4つ）。フォーマルなビジネス英語。TOEICらしい長さと語彙帯。

## 5. トピック
ビジネス・物流・人事・財務・マーケティング・オフィス・契約・メール・会議など頻出分野を網羅。

## 6. 各項目の形式
- question: 上記の短文（空欄 ____）
- options: 4つの文字列の配列（A,B,C,D に対応）
- correct_index: 0〜3
- explanation: なぜ正解か、20文字以内の日本語で瞬時解説
- category: "品詞"|"時制"|"前置詞"|"語彙"|"接続詞"|"代名詞"|"その他"
- difficulty: "500"|"700"|"900"
- vocab_map: 問題文および選択肢に登場する重要単語について、TOEIC Part 5 で使われる意味を日本語で最大3つ（使用頻度順）。名詞・動詞・形容詞・副詞・接続詞・前置詞を優先して含める。例: {"affect": ["影響する","〜に作用する","感動させる"], "directly": ["直接に","すぐに","率直に"]}。

※ 問題文・選択肢に含まれる単語のうち、一般的な単語帳に載っていない難語やビジネス語彙が出てきた場合も vocab_map に含めておくこと。後からアプリの「単語全国」用デフォルト辞書に、その単語の Part 5 で使われる上位3意味が自動で追加される。

Output ONLY a single JSON array. No markdown, no explanation.`;

export const VALIDATOR_PROMPT = `You are a TOEIC Part 5 quality checker. Score each question 0-100.

Criteria:
1) Exactly one correct answer (50 pts): In context, only one option is grammatically and semantically correct; the other three are clearly wrong. If two options could be defended, deduct heavily.
2) Natural business English (50 pts): The sentence is idiomatic, formal, and appropriate for TOEIC.

Reply with ONLY a JSON object: {"score": number, "pass": true if score >= 85 else false}

Question to score:`;

export const BATCH_SIZE_QUESTIONS = BATCH_SIZE;
