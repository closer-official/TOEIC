import { db, type Word } from './db';

const SEED_WORDS: Omit<Word, 'createdAt'>[] = [
  { id: '1', question: 'announce', options: ['発表する', '買収する', '実施する', '延期する'], correctIndex: 0, type: 'vocabulary' },
  { id: '2', question: 'acquire', options: ['発表する', '買収する', '実施する', '延期する'], correctIndex: 1, type: 'vocabulary' },
  { id: '3', question: 'conduct', options: ['発表する', '買収する', '実施する', '延期する'], correctIndex: 2, type: 'vocabulary' },
  { id: '4', question: 'postpone', options: ['発表する', '買収する', '実施する', '延期する'], correctIndex: 3, type: 'vocabulary' },
  { id: '5', question: 'ensure', options: ['確実にする', '超える', '期限が切れる', '特集する'], correctIndex: 0, type: 'vocabulary' },
  { id: '6', question: 'exceed', options: ['確実にする', '超える', '期限が切れる', '特集する'], correctIndex: 1, type: 'vocabulary' },
  { id: '7', question: 'expire', options: ['確実にする', '超える', '期限が切れる', '特集する'], correctIndex: 2, type: 'vocabulary' },
  { id: '8', question: 'feature', options: ['確実にする', '超える', '期限が切れる', '特集する'], correctIndex: 3, type: 'vocabulary' },
];

export async function seedIfEmpty(): Promise<void> {
  const count = await db.words.count();
  if (count > 0) return;
  const now = Date.now();
  await db.words.bulkAdd(SEED_WORDS.map((w) => ({ ...w, createdAt: now })));
}
