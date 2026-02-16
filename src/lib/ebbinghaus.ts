/**
 * 記憶保持率 R = e^(-t/S)
 * t: 経過時間（日）, S: 記憶強度
 */

export type MemoryStage = 1 | 2 | 3 | 4 | 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeRetentionRate(tDays: number, S: number): number {
  if (S <= 0) return 0;
  return Math.exp(-tDays / S);
}

/** 正解時: ステージ+1または+2、次回間隔を2.5倍 */
export function onCorrect(
  stage: MemoryStage,
  intervalMs: number,
  memoryStrength: number,
  fastAnswer?: boolean
): { stage: MemoryStage; nextIntervalMs: number; newStrength: number } {
  const newStage = Math.min(5, stage + (fastAnswer ? 2 : 1)) as MemoryStage;
  const newInterval = intervalMs * 2.5;
  const newStrength = Math.min(10, memoryStrength + 0.5);
  return {
    stage: newStage,
    nextIntervalMs: newStage >= 5 ? 365 * MS_PER_DAY : newInterval,
    newStrength,
  };
}

/** 不正解/タイムアップ: ステージ1にリセット */
export function onMiss(): {
  stage: MemoryStage;
  nextIntervalMs: number;
  newStrength: number;
} {
  return {
    stage: 1,
    nextIntervalMs: MS_PER_DAY * 0.5,
    newStrength: 0.5,
  };
}

/** 初回またはステージから次回復習までの間隔（ミリ秒） */
export function getIntervalForStage(stage: MemoryStage): number {
  const base = MS_PER_DAY * 0.5;
  const multipliers: Record<MemoryStage, number> = {
    1: 0.5,
    2: 1,
    3: 2.5,
    4: 7,
    5: 30,
  };
  return base * multipliers[stage];
}
