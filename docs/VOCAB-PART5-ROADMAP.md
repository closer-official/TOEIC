# 語彙・Part 5 特化ロードマップ

リスニングと長文読解は他教材に任せ、**このアプリは語彙と Part 5 を完璧に仕上げて差別化する**ための方針と実行順です。

---

## 1. 足りていない部分の整理

### 語彙

| 項目 | 現状 | 目標 |
|------|------|------|
| **見出し語数** | 1,855 語 | 3,000〜5,000 語（700〜800 点帯をカバー） |
| **2〜3 意味化** | 754 語が 2 つ以上、**1,101 語が 1 つのみ** | 全語を 2〜3 意味に |
| **出題数（延べ）** | 約 2,874 問 | 5,000 問以上を目安に |

### Part 5

| 項目 | 現状 | 目標 |
|------|------|------|
| **問題数** | Supabase 次第（pipeline 実行で増加） | 静的問題 100〜200 問をリポジトリに追加し、API なしでも利用可能に |
| **カテゴリ・難易度** | 品詞・語彙・文法あり、難易度 500/700/900 | 品詞 40%・語彙 30%・文法 30% のバランスを明示・維持 |

---

## 2. 実行順（何からやるか）

### Phase 1：語彙の 2〜3 意味化を完了させる【最優先】

- **やること**: 残り **約 1,101 語** に 2 つ目・3 つ目の意味を追加する。
- **方法**:  
  - `data/vocab-words-needing-extra-meanings.json` に「意味 1 つのみ」の語リストあり。  
  - `scripts/build-additional-meanings.js` の PAIRS に、このリストから語を選び `[ word, 追加意味1, 追加意味2 ]` を追加。  
  - 実行: `node scripts/build-additional-meanings.js` → `node scripts/enrich-vocab-from-static.js`
- **効果**: API 不要・無料で、単語モードの質が一気に上がる。他教材との差別化（1 語 3 意味・品詞付き）が明確になる。
- **進め方**: 1 回に 100〜200 語ずつ PAIRS を追加し、build → enrich を繰り返すとよい。

### Phase 2：語彙数を 3,000 語前後まで増やす

- **やること**: TOEIC 頻出リスト等から見出し語を追加し、3,000〜5,000 語規模にする。
- **方法**: `build-additional-meanings.js` の PAIRS や `scripts/seed-remaining-vocab.js` 等で新規語を追加。既存のデータ形式に合わせる。
- **効果**: 700〜800 点帯の語彙カバーが厚くなる。

### Phase 3：Part 5 を「完璧」に

- **A. 静的問題の追加**  
  - リポジトリに Part 5 問題を **100〜200 問**（品詞・語彙・文法バランスよく）追加。  
  - Supabase が空でもローカル／本番で問題を出題できるようにする。
- **B. pipeline の整備**  
  - プロンプトでカテゴリ・難易度の割合を明示。  
  - ユーザーが `node scripts/pipeline.ts` を実行しやすいよう手順を README 等に記載。

### Phase 4：差別化の明文化

- README やアプリ内で以下を明示する。  
  - 「語彙＋Part 5 に特化」「1 語最大 3 意味」「品詞付き」「他単語の意味のみを選択肢にした 4 択」など。

---

## 3. まず何からやるか（推奨）

**Phase 1（残り約 1,101 語の 2〜3 意味化）** から着手するのがおすすめです。

1. **既存の仕組みだけで完結する**（build → enrich、API 不要）
2. **一度反映すればずっと効く**
3. **ユーザー体験がすぐに良くなる**（単語モードで「1 意味だけ」の語が減る）
4. 完了後に Phase 2（語彙数増強）や Phase 3（Part 5 静的問題）に自然につなげられる

Phase 1 の具体的な進め方:

1. `node scripts/list-vocab-needing-extra-meanings.js` で「意味 1 つのみ」の語リストを確認（または `data/vocab-words-needing-extra-meanings.json` を参照）。
2. `scripts/build-additional-meanings.js` の PAIRS に、上記リストから 100〜200 語分の `[ word, 追加意味1, 追加意味2 ]` を追加。
3. `node scripts/build-additional-meanings.js` → `node scripts/enrich-vocab-from-static.js` を実行。
4. 必要なら 2〜3 を繰り返し、1,101 語をすべて 2〜3 意味にしていく。

---

## 4. 関連ファイル

| 用途 | ファイル |
|------|----------|
| 追加意味の生成（PAIRS → JSON） | `scripts/build-additional-meanings.js` |
| 静的マージ（JSON → default-vocab） | `scripts/enrich-vocab-from-static.js` |
| 意味 1 つのみの語リスト出力 | `scripts/list-vocab-needing-extra-meanings.js` |
| 意味 1 つのみの語リスト（データ） | `data/vocab-words-needing-extra-meanings.json` |
| 語彙・Part 5 のカバー範囲説明 | `docs/TOEIC-coverage.md` |
