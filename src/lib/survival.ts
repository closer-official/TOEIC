/**
 * サバイバル・クロック仕様（SPEC-SURVIVAL-CLOCK.md）の定数とヘルパー
 */

export type SurvivalRank = 'ROOKIE' | 'ACE' | 'LEGEND';

/** 画面端までの到達時間（秒）— 各モードの1問あたりの制限時間 */
export const RANK_TIME_TO_EDGE_SEC: Record<SurvivalRank, number> = {
  ROOKIE: 30,
  ACE: 60,
  LEGEND: 120,
};

export const INITIAL_SURVIVAL_SEC = 30;
export const MAX_SURVIVAL_SEC = 60;
export const CORRECT_ADD_SEC = 2;
export const COMBO_BONUS_SEC = 3;
export const COMBO_BONUS_INTERVAL = 5;
export const WRONG_PENALTY_SEC = 5;
export const SKIP_PENALTY_SEC = 3;
export const STUN_DURATION_MS = 200;
export const FEVER_ENTRY_COMBO = 15;
export const FEVER_DURATION_SEC = 10;
export const FEVER_BAR_DURATION_MS = 1500;

/** 5コンボ: 1.2倍速, 10コンボ: 1.5倍速 */
export function getSpeedMultiplier(combo: number): number {
  if (combo >= 10) return 1.5;
  if (combo >= 5) return 1.2;
  return 1;
}

/** 1問あたりのバー時間（ミリ秒）。ランク・コンボ・FEVERで変動 */
export function getBarDurationMs(
  rank: SurvivalRank,
  combo: number,
  isFever: boolean
): number {
  if (isFever) return FEVER_BAR_DURATION_MS;
  const baseMs = RANK_TIME_TO_EDGE_SEC[rank] * 1000;
  return Math.round(baseMs / getSpeedMultiplier(combo));
}

/** 10コンボ以上でスコア2倍 */
export function getScorePerCorrect(combo: number): number {
  return combo >= 10 ? 2 : 1;
}
