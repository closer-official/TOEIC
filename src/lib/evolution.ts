export type EvolutionBranch = 'correct_time' | 'score' | 'wrong_penalty';

/** シーズン分岐3つは1か月でリセットするため 1000 から2倍ずつ。 */
export const EVOLUTION_COST_INITIAL: Record<EvolutionBranch, number> = {
  correct_time: 1_000,
  score: 1_000,
  wrong_penalty: 1_000,
};

/** シーズン分岐はLv.10まで。翌シーズンはLv.10達成時1.01倍キャリーで再スタート。 */
export const SEASON_BRANCHES: EvolutionBranch[] = ['correct_time', 'score', 'wrong_penalty'];

export function costForNextLevel(currentLevel: number, branch?: EvolutionBranch): number {
  const isSeasonBranch = branch ? SEASON_BRANCHES.includes(branch) : true;
  const maxLevel = isSeasonBranch ? 10 : 9;
  if (currentLevel >= maxLevel) return Infinity;
  const base = branch ? EVOLUTION_COST_INITIAL[branch] : EVOLUTION_COST_INITIAL.correct_time;
  return base * Math.pow(2, currentLevel);
}
/** 1分岐フル（Lv0→10）の合計XP。1000×（2^0+...+2^9）= 1023000 */
export const EVOLUTION_TOTAL_FOR_ONE_BRANCH = 1_023_000;

/** 研鑽の極意: 正解時タイム加算倍率。seasonCarry: 前シーズンLv.10で0.01 (1.01倍) */
export function correctTimeMultiplier(level: number, seasonCarry = 0): number {
  return 1 + seasonCarry + 0.01 * level;
}
/** 至高の技巧: スコア倍率。seasonCarry: 前シーズンLv.10で0.01 (1.01倍) */
export function scoreMultiplier(level: number, seasonCarry = 0): number {
  return 1 + seasonCarry + 0.01 * level;
}
/** 魂の燃焼は誤答ペナルティには使わずスタミナ回復短縮のみ。誤答時は常に1.0倍 */
export function wrongPenaltyMultiplier(_level: number, _seasonCarry = 0): number {
  return 1;
}
