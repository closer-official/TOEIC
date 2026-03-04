/**
 * 語彙「スライディング・拡張ウィンドウ」＋ フィーバー用レジェンダリー ＋ リベンジスタック用バッチ
 * 出題: 1単語につき1問のみ。意味は translation_1 / translation_2 のいずれかをランダムに1つ使用。
 * 4択は正解1つ・不正解3つとも同じ品詞（意味から推測）で揃える。
 */

import type { GameQuestion } from '@/types/game';

export type VocabEntry = { word: string; pos?: string; meanings?: string[] };

const VOCAB_PLACEHOLDERS = ['（該当なし）', '（不明）', '（×）'] as const;

/** 旧データ・global_vocabulary 混在対策: 品詞表記を除去して表示を統一（品詞は表示しない仕様） */
export function stripPosForDisplay(s: string): string {
  if (!s || typeof s !== 'string') return s;
  let t = s.trim();
  t = t.replace(/\s*[（(][動名形副接前助]詞?[）)]\s*$/g, '').trim();
  t = t.replace(/\s*[（(](形容詞|副詞|接続詞|前置詞|助動詞|動詞|名詞)[）)]\s*$/g, '').trim();
  t = t.replace(/^(動詞|名詞|形容詞|副詞|接続詞|前置詞|助動詞)\s+/, '').trim();
  t = t.replace(/^[動名形副接前助]\s+/, '').trim();
  return t;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/** 意味の文言から品詞を推測（選択肢を同じ品詞で揃えるため。表示はしない） */
export function inferPosFromMeaning(meaning: string): string {
  if (!meaning || typeof meaning !== 'string') return '名';
  const m = meaning.trim();
  if (/する$|れる$|られる$/.test(m)) return '動';
  if (/な$|的な$|の$|い$|た$/.test(m) && !/する$/.test(m)) return '形';
  if (/に$|く$|と$/.test(m) && m.length < 8) return '副';
  if (/者|人|料|書|性|率|金|費|権|法|式|所|業|品|物|力|度|化|的$/.test(m)) return '名';
  return '名';
}

/** 1単語1カード。意味は meanings からランダムに1つのみ使用（同単語の translation_1/2 を同時に出題しない） */
function expandToCards(
  list: VocabEntry[],
  startIndex: number
): { word: string; meaning: string; wordIndex: number }[] {
  const cards: { word: string; meaning: string; wordIndex: number }[] = [];
  list.forEach((v, i) => {
    const raw = Array.isArray(v.meanings) && v.meanings.length > 0 ? v.meanings : [v.word];
    const normalized = raw.map((m) => stripPosForDisplay(String(m ?? '').trim())).filter(Boolean);
    const unique = [...new Set(normalized)] as string[];
    if (unique.length === 0) return;
    const meaning = unique[Math.floor(Math.random() * unique.length)]!;
    const word = stripPosForDisplay(String(v.word ?? '').trim());
    if (!word) return;
    cards.push({ word, meaning, wordIndex: startIndex + i });
  });
  return cards;
}

function difficultyFromWordIndex(index: number, total: number): string {
  if (total <= 0) return '500';
  if (index >= total * 0.75) return '900';
  if (index >= total * 0.5) return '700';
  return '500';
}

/** 1カードから1問を生成。誤答は「意味から推測した品詞」が同じものだけ。問題文は単語のみ（品詞は表示しない） */
function cardToQuestion(
  card: { word: string; meaning: string; wordIndex: number },
  allCards: { word: string; meaning: string }[],
  totalWords: number,
  idSuffix: string
): GameQuestion {
  const cardPos = inferPosFromMeaning(card.meaning);
  const byPos = new Map<string, string[]>();
  for (const c of allCards) {
    if (c.word === card.word) continue;
    const p = inferPosFromMeaning(c.meaning);
    if (!byPos.has(p)) byPos.set(p, []);
    byPos.get(p)!.push(c.meaning);
  }
  const samePosMeanings = [...new Set(byPos.get(cardPos) ?? [])].filter((m) => m !== card.meaning);
  const wrongs = shuffle(samePosMeanings).slice(0, 3);
  let pi = 0;
  while (wrongs.length < 3) {
    wrongs.push(VOCAB_PLACEHOLDERS[pi] ?? `（選択肢${pi + 1}）`);
    pi++;
  }
  const fourOptions = shuffle([card.meaning, ...wrongs]) as [string, string, string, string];
  const correctIndex = fourOptions.indexOf(card.meaning);
  return {
    id: `vocab-${card.word}-${idSuffix}-${card.meaning.slice(0, 12)}`,
    question: card.word,
    options: fourOptions,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
    type: 'vocabulary',
    difficulty: difficultyFromWordIndex(card.wordIndex, totalWords),
  };
}

/** ウィンドウ [0, windowEnd) からランダムに count 問を生成 */
export function getRandomQuestionsFromWindow(
  list: VocabEntry[],
  windowEnd: number,
  count: number,
  totalWords: number
): GameQuestion[] {
  const slice = list.slice(0, Math.min(windowEnd, list.length));
  const cards = expandToCards(slice, 0);
  const selected = shuffle(cards).slice(0, count);
  if (selected.length === 0) return [];
  return selected.map((c, i) =>
    cardToQuestion(c, cards, totalWords, `w${Date.now()}-${i}`)
  );
}

/** リベンジ1問を「直近5問以内」に含めるバッチを組み立てる */
export function buildRefillBatch(
  list: VocabEntry[],
  windowEnd: number,
  revengeStack: GameQuestion[],
  batchSize: number,
  totalWords: number
): { questions: GameQuestion[]; usedRevengeIds: string[] } {
  const REVENGE_IN_FIRST = 5;
  const usedRevengeIds: string[] = [];
  const oneRevenge = revengeStack.length > 0 ? revengeStack[0] : null;
  if (oneRevenge) usedRevengeIds.push(oneRevenge.id);

  const fromWindow = getRandomQuestionsFromWindow(
    list,
    windowEnd,
    batchSize - (oneRevenge ? 1 : 0),
    totalWords
  );
  if (oneRevenge && fromWindow.length >= REVENGE_IN_FIRST - 1) {
    const revengeSlot = Math.floor(Math.random() * Math.min(REVENGE_IN_FIRST, fromWindow.length + 1));
    const out: GameQuestion[] = [];
    let wi = 0;
    for (let i = 0; i < batchSize; i++) {
      if (i === revengeSlot) {
        out.push(oneRevenge);
      } else if (wi < fromWindow.length) {
        out.push(fromWindow[wi++]);
      }
    }
    while (wi < fromWindow.length) out.push(fromWindow[wi++]);
    return { questions: out.slice(0, batchSize), usedRevengeIds };
  }
  if (oneRevenge) {
    const out = [oneRevenge, ...fromWindow].slice(0, batchSize);
    return { questions: out, usedRevengeIds };
  }
  return { questions: fromWindow.slice(0, batchSize), usedRevengeIds };
}

/** フィーバー用: 未出題かつ後半優先で count 問を生成 */
export function getFeverQuestions(
  list: VocabEntry[],
  seenIds: Set<string>,
  count: number
): GameQuestion[] {
  const total = list.length;
  const half = Math.floor(total / 2);
  const pool = list.map((v, index) => ({ v, index }));
  const unseen = pool.filter(({ v }) => {
    const idPrefix = `vocab-${v.word}`;
    return ![...seenIds].some((id) => id.startsWith(idPrefix));
  });
  const later = unseen.filter(({ index }) => index >= half);
  const rest = unseen.filter(({ index }) => index < half);
  const ordered = [...shuffle(later), ...shuffle(rest)];
  const take = ordered.slice(0, Math.max(count * 2, 50));
  const cards: { word: string; meaning: string; wordIndex: number }[] = [];
  take.forEach(({ v, index }) => {
    const raw = Array.isArray(v.meanings) && v.meanings.length > 0 ? v.meanings : [v.word];
    const normalized = raw.map((m) => stripPosForDisplay(String(m ?? '').trim())).filter(Boolean);
    const unique = [...new Set(normalized)] as string[];
    if (unique.length === 0) return;
    const meaning = unique[Math.floor(Math.random() * unique.length)]!;
    const word = stripPosForDisplay(String(v.word ?? '').trim());
    if (!word) return;
    cards.push({ word, meaning, wordIndex: index });
  });
  const selected = shuffle(cards).slice(0, count);
  if (selected.length === 0) return [];
  return selected.map((c, i) =>
    cardToQuestion(c, cards, total, `fever-${Date.now()}-${i}`)
  );
}

export const WINDOW_INITIAL = 200;
export const WINDOW_EXPAND_STEP = 50;
export const VOCAB_REFILL_THRESHOLD = 5;
export const VOCAB_REFILL_BATCH_SIZE = 15;
export const FEVER_QUESTIONS_COUNT = 10;
