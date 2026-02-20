/**
 * 瞬（SHUN）スコアロジック — 教育的均衡モデル
 * レアリティ別基礎点・コンボ倍率・スピードボーナス・ランク認定
 */

/** レアリティ（全国正答率と連動想定。現状は難易度から導出可能） */
export type ShunRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

/** レアリティ別基礎点（BP）。最大3倍差に収める */
export const RARITY_BASE_POINTS: Record<ShunRarity, number> = {
  COMMON: 1000,       // 白, 80%以上
  UNCOMMON: 1200,     // 緑, 60〜79%
  RARE: 1500,         // 青, 40〜59%
  EPIC: 2000,         // 紫, 20〜39%
  LEGENDARY: 3000,    // 金, 20%未満
};

/** 難易度（500/700/900）からレアリティを導出（全国正答率の代用） */
export function rarityFromDifficulty(difficulty: string | undefined): ShunRarity {
  if (difficulty === '900') return 'RARE';
  if (difficulty === '700') return 'UNCOMMON';
  return 'COMMON'; // 500 or 未設定
}

/** コンボ倍率: 1 + Combo/10（10コンボで2倍、50で6倍、100で11倍） */
export function comboMultiplier(combo: number): number {
  return 1 + combo / 10;
}

/** スピードボーナス: 1 + (RemainingRate × 0.5)。即答1.5倍、残り半分1.25倍、ギリギリ1.0倍 */
export function speedBonus(remainingRate: number): number {
  const r = Math.max(0, Math.min(1, remainingRate));
  return 1 + r * 0.5;
}

/** 1問あたりのスコア: ceil(BP × ComboMultiplier × SpeedBonus) */
export function scorePerQuestion(
  basePoints: number,
  combo: number,
  remainingRate: number
): number {
  const mult = comboMultiplier(combo);
  const bonus = speedBonus(remainingRate);
  return Math.ceil(basePoints * mult * bonus);
}

/** ランク・マイルストーン（全国ランキング評価用） */
export type ShunRank = 'S' | 'A' | 'B' | null;

export function getShunRank(
  totalScore: number,
  maxCombo: number,
  correctRate: number
): ShunRank {
  if (totalScore >= 1_000_000 && maxCombo >= 50) return 'S';
  if (totalScore >= 500_000 && correctRate >= 0.9) return 'A';
  if (totalScore >= 100_000) return 'B';
  return null;
}
