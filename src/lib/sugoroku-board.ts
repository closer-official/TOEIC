/**
 * 運命のすごろく - 全36マス定義（新・配置順）
 * イベント週ごと。月曜0時JSTでリセット。借金はイベント終了時に免除。
 */

export type SpaceKind =
  | 'start'
  | 'neon'
  | 'hell_slippery'
  | 'dice_gem'
  | 'buffet'
  | 'straight'
  | 'shop'
  | 'eternal_altar'
  | 'black_hole'
  | 'luxury'
  | 'trap_guard'
  | 'gambling'
  | 'last_gamble';

export type BoardSpace = {
  num: number;
  name: string;
  kind: SpaceKind;
  /** 通過時効果（STARTのみ: 500 XP） */
  passEffect?: { eventXp?: number };
  /** 停止時効果 */
  stopEffect?: {
    dice?: number;
    eventXp?: number;
    gems?: number;
    stamina?: number;
    moveBack?: number;
    goTo?: number;
    fragment?: number;
    trapGuard?: boolean;
    /** ランダム: 50% dice+1 / 50% eventXp -1000 */
    lastGamble?: true;
  };
  /** ネオン・ストレート等で範囲指定するときの min/max */
  eventXpRange?: [number, number];
  gemsRange?: [number, number];
};

/** 新・配置順（1〜36） */
const SPACES: BoardSpace[] = [
  { num: 1, name: 'グランドエントランス', kind: 'start', passEffect: { eventXp: 500 }, stopEffect: { dice: 1 } },
  { num: 2, name: 'ネオン・エリア', kind: 'neon', eventXpRange: [200, 500], gemsRange: [5, 10] },
  { num: 3, name: 'ダイス＆チップ', kind: 'dice_gem', stopEffect: { dice: 1 }, gemsRange: [5, 15] },
  { num: 4, name: 'ネオン・エリア', kind: 'neon', eventXpRange: [200, 500], gemsRange: [5, 10] },
  { num: 5, name: 'カジノ・ビュッフェ', kind: 'buffet', stopEffect: { stamina: 10 } },
  { num: 6, name: 'ストレート・ロード', kind: 'straight', eventXpRange: [100, 400], gemsRange: [3, 12] },
  { num: 7, name: '地獄：スリッパリー', kind: 'hell_slippery', stopEffect: { moveBack: 2 } },
  { num: 8, name: 'ネオン・エリア', kind: 'neon', eventXpRange: [200, 500], gemsRange: [5, 10] },
  { num: 9, name: '用心棒の休息所', kind: 'trap_guard', stopEffect: { trapGuard: true } },
  { num: 10, name: 'ストレート・ロード', kind: 'straight', eventXpRange: [100, 400], gemsRange: [3, 12] },
  { num: 11, name: 'ギャンブル・ゾーン', kind: 'gambling', stopEffect: { gems: 25 }, gemsRange: [20, 40] },
  { num: 12, name: 'ダイス＆チップ', kind: 'dice_gem', stopEffect: { dice: 1 }, gemsRange: [5, 15] },
  { num: 13, name: 'ギャンブル・ゾーン', kind: 'gambling', stopEffect: { eventXp: -200 } },
  { num: 14, name: 'ストレート・ロード', kind: 'straight', eventXpRange: [100, 400], gemsRange: [3, 12] },
  { num: 15, name: 'ネオン・エリア', kind: 'neon', eventXpRange: [200, 500], gemsRange: [5, 10] },
  { num: 16, name: 'ギャンブル・ゾーン', kind: 'gambling', stopEffect: { eventXp: -200 } },
  { num: 17, name: 'ディーラーズ・ショップ', kind: 'shop' },
  { num: 18, name: 'エターナル・アルター', kind: 'eternal_altar', stopEffect: { fragment: 1 } },
  { num: 19, name: '最凶：ブラックホール', kind: 'black_hole', stopEffect: { goTo: 5 } },
  { num: 20, name: 'ストレート・ロード', kind: 'straight', eventXpRange: [100, 400], gemsRange: [3, 12] },
  { num: 21, name: 'ラグジュアリー', kind: 'luxury', eventXpRange: [300, 600], gemsRange: [10, 25] },
  { num: 22, name: 'ギャンブル・ゾーン', kind: 'gambling', stopEffect: { eventXp: -200 } },
  { num: 23, name: 'ラグジュアリー', kind: 'luxury', eventXpRange: [300, 600], gemsRange: [10, 25] },
  { num: 24, name: 'ダイス＆チップ', kind: 'dice_gem', stopEffect: { dice: 1 }, gemsRange: [5, 15] },
  { num: 25, name: 'ラグジュアリー', kind: 'luxury', eventXpRange: [300, 600], gemsRange: [10, 25] },
  { num: 26, name: 'ギャンブル・ゾーン', kind: 'gambling', stopEffect: { gems: 25 }, gemsRange: [20, 40] },
  { num: 27, name: 'ラグジュアリー', kind: 'luxury', eventXpRange: [300, 600], gemsRange: [10, 25] },
  { num: 28, name: 'ストレート・ロード', kind: 'straight', eventXpRange: [100, 400], gemsRange: [3, 12] },
  { num: 29, name: 'ラグジュアリー', kind: 'luxury', eventXpRange: [300, 600], gemsRange: [10, 25] },
  { num: 30, name: 'ギャンブル・ゾーン', kind: 'gambling', stopEffect: { gems: 25 }, gemsRange: [20, 40] },
  { num: 31, name: 'ラグジュアリー', kind: 'luxury', eventXpRange: [300, 600], gemsRange: [10, 25] },
  { num: 32, name: 'ストレート・ロード', kind: 'straight', eventXpRange: [100, 400], gemsRange: [3, 12] },
  { num: 33, name: 'ラグジュアリー', kind: 'luxury', eventXpRange: [300, 600], gemsRange: [10, 25] },
  { num: 34, name: 'ギャンブル・ゾーン', kind: 'gambling', stopEffect: { gems: 25 }, gemsRange: [20, 40] },
  { num: 35, name: 'ラグジュアリー', kind: 'luxury', eventXpRange: [300, 600], gemsRange: [10, 25] },
  { num: 36, name: 'ラスト・ギャンブル', kind: 'last_gamble', stopEffect: { lastGamble: true } },
];

export const BOARD_SPACES = SPACES;
export const TOTAL_SPACES = 36;

/** 周回ボーナス: 10周・20周で欠片1個 */
export const LAP_FRAGMENT_BONUS_AT = [10, 20];

export function getSpace(num: number): BoardSpace | undefined {
  return SPACES.find((s) => s.num === num);
}

/** 1〜6のランダム出目 */
export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/** 範囲内ランダム整数 [min, max] */
export function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
