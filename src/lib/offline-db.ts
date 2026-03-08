/**
 * オフライン用 IndexedDB（単語・Part5キャッシュ、未送信run、スタミナメタ、ダウンロード状態）
 */
import Dexie, { type EntityTable } from 'dexie';

export type SubscriptionTier = 'free' | 'pro' | 'ultra';

export interface OfflineStaminaMeta {
  staminaCount: number;
  lastStaminaAt: string | null;
  subscriptionTier: SubscriptionTier;
  evolutionStaminaBonus: number;
  recoverySpeedMultiplier: number;
  /** 取得した時刻（クライアント） */
  fetchedAt: number;
}

export interface OfflinePendingRun {
  id: string;
  score: number;
  totalTimeMs: number;
  game_mode: 'vocab' | 'part5';
  staminaAmount: number;
  survival_rank?: string;
  checkpoints?: unknown;
  question_ids?: string[] | null;
  /** evolution POST 用 */
  scoreToShow: number;
  epMult: number;
  createdAt: number;
}

export interface OfflineVocabCache {
  version: string;
  list: Array<{ word: string; meanings?: string[] }>;
  savedAt: number;
}

export interface OfflinePart5Cache {
  version: string;
  questions: Array<{
    id: string;
    question: string;
    options: string[] | [string, string, string, string];
    correct_index: number;
    explanation?: string | null;
    category?: string;
    difficulty?: string;
    vocab_map?: Record<string, string[]>;
  }>;
  savedAt: number;
}

export interface OfflineDownloadState {
  firstDownloadDone: boolean;
  vocabVersion: string;
  part5Version: string;
  updatedAt: number;
}

class CloserOfflineDB extends Dexie {
  staminaMeta!: EntityTable<{ key: 'meta'; value: OfflineStaminaMeta }, 'key'>;
  pendingRuns!: EntityTable<OfflinePendingRun, 'id'>;
  vocabCache!: EntityTable<{ key: 'list'; value: OfflineVocabCache }, 'key'>;
  part5Cache!: EntityTable<{ key: 'bundle'; value: OfflinePart5Cache }, 'key'>;
  downloadState!: EntityTable<{ key: 'state'; value: OfflineDownloadState }, 'key'>;

  constructor() {
    super('CloserOfflineDB');
    this.version(1).stores({
      staminaMeta: 'key',
      pendingRuns: 'id, createdAt',
      vocabCache: 'key',
      part5Cache: 'key',
      downloadState: 'key',
    });
  }
}

export const offlineDb = new CloserOfflineDB();

const META_KEY = 'meta' as const;
const VOCAB_KEY = 'list' as const;
const PART5_KEY = 'bundle' as const;
const STATE_KEY = 'state' as const;

export async function getStaminaMeta(): Promise<OfflineStaminaMeta | null> {
  const row = await offlineDb.staminaMeta.get(META_KEY);
  return row?.value ?? null;
}

export async function setStaminaMeta(meta: Omit<OfflineStaminaMeta, 'fetchedAt'>): Promise<void> {
  await offlineDb.staminaMeta.put({
    key: META_KEY,
    value: { ...meta, fetchedAt: Date.now() },
  });
}

export async function getPendingRuns(): Promise<OfflinePendingRun[]> {
  return offlineDb.pendingRuns.orderBy('createdAt').toArray();
}

export async function addPendingRun(run: OfflinePendingRun): Promise<void> {
  await offlineDb.pendingRuns.add(run);
}

export async function removePendingRunsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await offlineDb.pendingRuns.bulkDelete(ids);
}

export async function getVocabCache(): Promise<OfflineVocabCache | null> {
  const row = await offlineDb.vocabCache.get(VOCAB_KEY);
  return row?.value ?? null;
}

export async function setVocabCache(cache: Omit<OfflineVocabCache, 'savedAt'>): Promise<void> {
  await offlineDb.vocabCache.put({
    key: VOCAB_KEY,
    value: { ...cache, savedAt: Date.now() },
  });
}

export async function getPart5Cache(): Promise<OfflinePart5Cache | null> {
  const row = await offlineDb.part5Cache.get(PART5_KEY);
  return row?.value ?? null;
}

export async function setPart5Cache(cache: Omit<OfflinePart5Cache, 'savedAt'>): Promise<void> {
  await offlineDb.part5Cache.put({
    key: PART5_KEY,
    value: { ...cache, savedAt: Date.now() },
  });
}

export async function getDownloadState(): Promise<OfflineDownloadState | null> {
  const row = await offlineDb.downloadState.get(STATE_KEY);
  return row?.value ?? null;
}

export async function setDownloadState(state: Partial<OfflineDownloadState>): Promise<void> {
  const current = await getDownloadState();
  const next: OfflineDownloadState = {
    firstDownloadDone: state.firstDownloadDone ?? current?.firstDownloadDone ?? false,
    vocabVersion: state.vocabVersion ?? current?.vocabVersion ?? '',
    part5Version: state.part5Version ?? current?.part5Version ?? '',
    updatedAt: Date.now(),
  };
  await offlineDb.downloadState.put({ key: STATE_KEY, value: next });
}

export async function getPendingRunsCount(): Promise<number> {
  return offlineDb.pendingRuns.count();
}

/** 未送信 run のスタミナ消費合計（オフライン時の表示用） */
export async function getPendingRunsStaminaTotal(): Promise<number> {
  const runs = await offlineDb.pendingRuns.toArray();
  return runs.reduce((sum, r) => sum + (r.staminaAmount ?? 0), 0);
}
