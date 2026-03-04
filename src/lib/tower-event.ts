/**
 * 摩天楼のタワー - 三択エレベーター・気候・ゴースト仕様
 */

export type TowerElevatorId = 'vip' | 'risk' | 'technical';

/** VIP専用機: G(n) ジェム, 100%成功。Risk: G(n)*0.5, 60〜80%→高層で減衰。Technical: G(n)*0.2, 30%成功、失敗で階層XPリセット */
export const TOWER_ELEVATORS: Record<
  TowerElevatorId,
  { id: TowerElevatorId; name: string; nameEn: string; costRate: number; baseSuccessPct: number | null; failPenalty: string }
> = {
  vip: {
    id: 'vip',
    name: 'VIP専用機',
    nameEn: 'Safe',
    costRate: 1,
    baseSuccessPct: 100,
    failPenalty: 'なし（確実に1階上昇）',
  },
  risk: {
    id: 'risk',
    name: 'ギャンブラー・リフト',
    nameEn: 'Risk',
    costRate: 0.5,
    baseSuccessPct: 70,
    failPenalty: '1〜3階落下',
  },
  technical: {
    id: 'technical',
    name: '非常用ハッチ',
    nameEn: 'Technical',
    costRate: 0.2,
    baseSuccessPct: 30,
    failPenalty: '現在階層のXP進捗リセット',
  },
};

/** 階層 n の公式コスト G(n)。VIP = G(n), Risk = G(n)*0.5, Technical = G(n)*0.2 */
export function towerCostG(floor: number): number {
  return Math.max(1, Math.floor(10 + floor * 2));
}

/** ギャンブラー・リフト成功率 P(n) = BaseRate - (n × 0.5)。40階で20%低下。最小5%。 */
export function towerRiskSuccessPct(floor: number): number {
  const base = TOWER_ELEVATORS.risk.baseSuccessPct ?? 70;
  return Math.max(5, Math.min(80, base - floor * 0.5));
}

/** 気候: 3時間ごとに変化。0=快晴, 1=雷雨, 2=追い風 */
export type TowerClimateId = 'clear' | 'storm' | 'tailwind';

export const TOWER_CLIMATES: Record<
  TowerClimateId,
  { id: TowerClimateId; name: string; effect: string }
> = {
  clear: { id: 'clear', name: '快晴', effect: 'ギャンブラー・リフトの成功率 +10%' },
  storm: { id: 'storm', name: '雷雨', effect: 'VIP専用機のコスト 1.5倍' },
  tailwind: { id: 'tailwind', name: '追い風', effect: '非常用ハッチ成功時 2階上昇' },
};

const CLIMATE_ORDER: TowerClimateId[] = ['clear', 'storm', 'tailwind'];
const CLIMATE_ROTATION_MS = 3 * 60 * 60 * 1000;

/**
 * 今週の週開始からの経過で現在の塔の気候を算出（3時間ローテーション）
 */
export function getTowerClimate(weekStartMs: number): { climate: TowerClimateId; nextChangeMs: number } {
  const now = Date.now();
  const elapsed = now - weekStartMs;
  if (elapsed < 0) {
    return { climate: 'clear', nextChangeMs: weekStartMs };
  }
  const slot = Math.floor(elapsed / CLIMATE_ROTATION_MS);
  const climateIndex = slot % CLIMATE_ORDER.length;
  const climate = CLIMATE_ORDER[climateIndex] ?? 'clear';
  const nextChangeMs = weekStartMs + (slot + 1) * CLIMATE_ROTATION_MS;
  return { climate, nextChangeMs };
}

/** 気候補正後のVIPコスト倍率 */
export function towerVipCostMultiplier(climate: TowerClimateId): number {
  return climate === 'storm' ? 1.5 : 1;
}

/** 気候補正後のリスク成功率加算（%ポイント） */
export function towerRiskSuccessBonus(climate: TowerClimateId): number {
  return climate === 'clear' ? 10 : 0;
}

/** 非常用ハッチ成功時の上昇階数（追い風なら2） */
export function towerTechnicalSuccessFloors(climate: TowerClimateId): number {
  return climate === 'tailwind' ? 2 : 1;
}

/** タワー専用アイテム（時価） */
export const TOWER_ITEMS = {
  golden_oil: { id: 'golden_oil', name: '黄金のオイル', price: 300, effect: '次の1回、リフト成功率+20%' },
  shock_mat: { id: 'shock_mat', name: '衝撃吸収マット', price: 200, effect: '落下時1階分軽減' },
  master_key: { id: 'master_key', name: 'マスターキー', price: 500, effect: '次の5階、VIPコスト30%カット' },
} as const;

export type TowerItemId = keyof typeof TOWER_ITEMS;
