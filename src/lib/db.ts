import Dexie, { type EntityTable } from 'dexie';

export type MemoryStage = 1 | 2 | 3 | 4 | 5;

export interface Word {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  type: 'vocabulary' | 'grammar';
  createdAt: number;
}

export interface WordProgress {
  wordId: string;
  stage: MemoryStage;
  lastReviewedAt: number;
  nextReviewAt: number;
  memoryStrength: number;
  correctCount: number;
}

export const STAGE_LABELS: Record<MemoryStage, string> = {
  1: '新規',
  2: '滞在中',
  3: '定着中',
  4: '脳内資産',
  5: '殿堂入り',
};

class CloserDB extends Dexie {
  words!: EntityTable<Word, 'id'>;
  wordProgress!: EntityTable<WordProgress, 'wordId'>;

  constructor() {
    super('CloserDB');
    this.version(1).stores({
      words: 'id, type, createdAt',
      wordProgress: 'wordId, stage, nextReviewAt',
    });
  }
}

export const db = new CloserDB();
