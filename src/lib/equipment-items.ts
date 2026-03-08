/** 装備スロット */
export type EquipmentSlot = 'weapon' | 'head' | 'torso' | 'feet';

/** 装備特性 */
export type EquipmentTrait = '特定条件' | '安定スコア' | '経験値' | '時間延長' | '博打要素';

/** レアリティ */
export type EquipmentRarity = 'SR' | 'R' | 'N';

/** 装備効果のゲーム内キー（equipment-effects で使用） */
export type EquipmentEffectKey =
  | 'combo_bonus_multiplier'
  | 'score_add_rate'
  | 'xp_add_rate'
  | 'recovery_sec_per_5'
  | 'fate_heaven_multiplier'
  | 'reversal_recovery_multiplier'
  | 'combo_resume_multiplier'
  | 'minute_bonus_coefficient'
  | 'periodic_add_sec'
  | 'prophecy_multiplier'
  | 'last_stand_sec'
  | 'glory_stack_per_10'
  | 'growth_ex_per_10'
  | 'time_decay_rate'
  | 'tekka_buff_rate'
  | 'evolution_buff_multiplier'
  | 'final_bonus_coefficient'
  | 'speed_multiplier_super'
  | 'auto_recovery_sec'
  | 'idaten_add_sec';

export type EquipmentItem = {
  id: string;
  name: string;
  slot: EquipmentSlot;
  slotLabel: string;
  trait: EquipmentTrait;
  rarity: EquipmentRarity;
  /** 排出率（%）特性に応じて SR 2%, R 8%/15%, N 35%/40% */
  baseRate: number;
  effect: string;
  /** 効果のゲーム内キー（装備時のみ使用） */
  effectKey?: EquipmentEffectKey;
  /** Lv.1時の効果値（effect_base=1 のとき）。倍率はそのまま、%は0.10=10% */
  effectInitialValue?: number;
  /** 固定値（トリガー間隔・地獄倍率など）。未使用なら undefined */
  effectConstant?: number;
};

/** 全装備（武器・頭・胴体・足、各5種）
 * レアリティ・排出率: SR 2%(経験値), R 8%(博打) R 15%(安定スコア), N 35%(時間延長) N 40%(特定条件)
 */
export const GACHA_EQUIPMENT: EquipmentItem[] = [
  // 【武器】筆記・事務用品系
  {
    id: 'rensa_glass_pen',
    name: '連鎖の万年筆',
    slot: 'weapon',
    slotLabel: '武器',
    trait: '特定条件',
    rarity: 'N',
    baseRate: 40,
    effect: '10連続正解達成直後の次の1問のみ、獲得スコアとXPが [V]倍 になる。',
    effectKey: 'combo_bonus_multiplier',
    effectInitialValue: 5.0,
    effectConstant: 10,
  },
  {
    id: 'golden_sealing_stamp',
    name: '黄金のシーリングスタンプ',
    slot: 'weapon',
    slotLabel: '武器',
    trait: '安定スコア',
    rarity: 'R',
    baseRate: 15,
    effect: 'すべての正解時に得られる基礎スコアが常時 [V]% 増加する。',
    effectKey: 'score_add_rate',
    effectInitialValue: 0.10,
  },
  {
    id: 'skilled_highlighter',
    name: '熟練の蛍光マーカー',
    slot: 'weapon',
    slotLabel: '武器',
    trait: '経験値',
    rarity: 'SR',
    baseRate: 2,
    effect: 'すべての獲得XPが常時 [V]% 増加する。',
    effectKey: 'xp_add_rate',
    effectInitialValue: 0.15,
  },
  {
    id: 'enmei_tape',
    name: '延命の修正テープ',
    slot: 'weapon',
    slotLabel: '武器',
    trait: '時間延長',
    rarity: 'N',
    baseRate: 35,
    effect: '正解数が累計5問増えるごとに、残り時間が [V]秒 回復する。',
    effectKey: 'recovery_sec_per_5',
    effectInitialValue: 2.0,
    effectConstant: 5,
  },
  {
    id: 'unmei_feather_pen',
    name: '運命の羽ペン',
    slot: 'weapon',
    slotLabel: '武器',
    trait: '博打要素',
    rarity: 'R',
    baseRate: 8,
    effect: '正解時、50%でスコア [V]倍 、50%で本来の3倍分をマイナス。',
    effectKey: 'fate_heaven_multiplier',
    effectInitialValue: 3.0,
    effectConstant: -3,
  },
  // 【頭】アクセサリー系
  {
    id: 'gyakkyo_monocle',
    name: '逆境のモノクル',
    slot: 'head',
    slotLabel: '頭',
    trait: '特定条件',
    rarity: 'N',
    baseRate: 40,
    effect: '残り10秒以下で発動。正解時の時間回復量が [V]倍 になる。',
    effectKey: 'reversal_recovery_multiplier',
    effectInitialValue: 3.0,
    effectConstant: 10,
  },
  {
    id: 'gakusha_cap',
    name: '学者の角帽',
    slot: 'head',
    slotLabel: '頭',
    trait: '安定スコア',
    rarity: 'R',
    baseRate: 15,
    effect: 'コンボが途切れた際、倍率が1.0倍に戻らず [V]倍 から再スタートする。',
    effectKey: 'combo_resume_multiplier',
    effectInitialValue: 1.1,
  },
  {
    id: 'eichi_headset',
    name: '英知のヘッドセット',
    slot: 'head',
    slotLabel: '頭',
    trait: '経験値',
    rarity: 'SR',
    baseRate: 2,
    effect: 'ゲーム開始から1分ごとの区間（0〜1分、1〜2分…）の正解数に [V] を掛けたXPをボーナス獲得する。',
    effectKey: 'minute_bonus_coefficient',
    effectInitialValue: 10.0,
    effectConstant: 60,
  },
  {
    id: 'dosatsu_sunvisor',
    name: '洞察のサンバイザー',
    slot: 'head',
    slotLabel: '頭',
    trait: '時間延長',
    rarity: 'N',
    baseRate: 35,
    effect: '60秒経過するたびに、残り時間が確定で [V]秒 加算される。',
    effectKey: 'periodic_add_sec',
    effectInitialValue: 5.0,
    effectConstant: 60,
  },
  {
    id: 'yogensha_bandana',
    name: '預言者のバンダナ',
    slot: 'head',
    slotLabel: '頭',
    trait: '博打要素',
    rarity: 'R',
    baseRate: 8,
    effect: '60秒ごとに判定。50%で残り時間 [V]倍 、50%で 0.5倍 になる。',
    effectKey: 'prophecy_multiplier',
    effectInitialValue: 2.0,
    effectConstant: 0.5,
  },
  // 【胴体】ウェア系
  {
    id: 'dohyo_blazer',
    name: '土俵際のブレザー',
    slot: 'torso',
    slotLabel: '胴体',
    trait: '特定条件',
    rarity: 'N',
    baseRate: 40,
    effect: '残り時間が0秒になった瞬間、一度だけ時間を [V]秒間 停止させる。',
    effectKey: 'last_stand_sec',
    effectInitialValue: 3.0,
  },
  {
    id: 'eiko_tuxedo',
    name: '栄光のタキシード',
    slot: 'torso',
    slotLabel: '胴体',
    trait: '安定スコア',
    rarity: 'R',
    baseRate: 15,
    effect: '10問正解ごとに、基礎点に [V]点 （最大 [V]×10まで）永続加算。',
    effectKey: 'glory_stack_per_10',
    effectInitialValue: 50,
    effectConstant: 10,
  },
  {
    id: 'seicho_dress',
    name: '成長のドレス',
    slot: 'torso',
    slotLabel: '胴体',
    trait: '経験値',
    rarity: 'SR',
    baseRate: 2,
    effect: '10問正解ごとにXP倍率が [V]倍 ずつ加算（最大 [V]×10）。',
    effectKey: 'growth_ex_per_10',
    effectInitialValue: 0.05,
    effectConstant: 10,
  },
  {
    id: 'yukyu_trench',
    name: '悠久のトレンチコート',
    slot: 'torso',
    slotLabel: '胴体',
    trait: '時間延長',
    rarity: 'N',
    baseRate: 35,
    effect: '時間減少速度を [V]倍 にする（レベル増で数値は減少、他装備と同じ比率で減算）。',
    effectKey: 'time_decay_rate',
    effectInitialValue: 0.90,
  },
  {
    id: 'tekka_silk_shirt',
    name: '鉄火場のシルクシャツ',
    slot: 'torso',
    slotLabel: '胴体',
    trait: '博打要素',
    rarity: 'R',
    baseRate: 8,
    effect: '装備中スコア [V]% 増。ただし不正解時50%で即ゲームオーバー。',
    effectKey: 'tekka_buff_rate',
    effectInitialValue: 0.20,
    effectConstant: 0.50,
  },
  // 【足】シューズ・ソックス系
  {
    id: 'tsuigeki_sneakers',
    name: '追撃のヒール',
    slot: 'feet',
    slotLabel: '足',
    trait: '特定条件',
    rarity: 'N',
    baseRate: 40,
    effect: 'ゲーム開始から30秒間、獲得スコアとXPが [V]倍 になる。',
    effectKey: 'evolution_buff_multiplier',
    effectInitialValue: 1.5,
    effectConstant: 30,
  },
  {
    id: 'hanei_loafer',
    name: '繁栄のローファー',
    slot: 'feet',
    slotLabel: '足',
    trait: '安定スコア',
    rarity: 'R',
    baseRate: 15,
    effect: 'プレイ終了時に、最終総正解数に [V] を掛けたスコアを加算。',
    effectKey: 'final_bonus_coefficient',
    effectInitialValue: 100.0,
  },
  {
    id: 'hiyaku_track_spike',
    name: '飛躍のトラックスパイク',
    slot: 'feet',
    slotLabel: '足',
    trait: '経験値',
    rarity: 'SR',
    baseRate: 2,
    effect: '超速正解でXP [V]倍 、高速（3秒内）ならXP [Vの60%]倍 を付与。',
    effectKey: 'speed_multiplier_super',
    effectInitialValue: 2.0,
    effectConstant: 0.6,
  },
  {
    id: 'iji_compression_socks',
    name: '維持のコンプレッションソックス',
    slot: 'feet',
    slotLabel: '足',
    trait: '時間延長',
    rarity: 'N',
    baseRate: 35,
    effect: '15秒経過するごとに、残り時間が [V]秒 自動で加算される。',
    effectKey: 'auto_recovery_sec',
    effectInitialValue: 3.0,
    effectConstant: 15,
  },
  {
    id: 'idaten_dress_shoes',
    name: '韋駄天の下駄',
    slot: 'feet',
    slotLabel: '足',
    trait: '博打要素',
    rarity: 'R',
    baseRate: 8,
    effect: '60秒ごとに判定。50%で [V]秒 追加、50%で 30秒 没収される。',
    effectKey: 'idaten_add_sec',
    effectInitialValue: 30.0,
    effectConstant: 30,
  },
];

const SLOTS: EquipmentSlot[] = ['weapon', 'head', 'torso', 'feet'];

/** グレード進化: コモン→ノーマル→レア→エピック→レジェンダリー→エターナル。同じ装備5個で次グレードに進化 */
export type EquipmentGrade = 'common' | 'normal' | 'rare' | 'epic' | 'legendary' | 'eternal';

export const EQUIPMENT_GRADES: EquipmentGrade[] = ['common', 'normal', 'rare', 'epic', 'legendary', 'eternal'];

export const EQUIPMENT_GRADE_LABELS: Record<EquipmentGrade, string> = {
  common: 'コモン',
  normal: 'ノーマル',
  rare: 'レア',
  epic: 'エピック',
  legendary: 'レジェンダリー',
  eternal: 'エターナル',
};

export function nextEquipmentGrade(g: EquipmentGrade): EquipmentGrade | null {
  const i = EQUIPMENT_GRADES.indexOf(g);
  if (i < 0 || i >= EQUIPMENT_GRADES.length - 1) return null;
  return EQUIPMENT_GRADES[i + 1] ?? null;
}

/** 同一グレード内レベルアップに必要なXP。100, 200, 400, 800... */
export const EQUIPMENT_LEVEL_XP_BASE = 100;

export function costForEquipmentLevel(currentLevel: number): number {
  return EQUIPMENT_LEVEL_XP_BASE * Math.pow(2, currentLevel);
}

/** グレード進化に必要な全共通XP。common→normal 4000, normal→rare 8000, … legendary→eternal 64000 */
export const EQUIPMENT_EVOLVE_XP_BASE = 4000;

export function costForEquipmentEvolve(fromGrade: EquipmentGrade): number {
  const i = EQUIPMENT_GRADES.indexOf(fromGrade);
  if (i < 0 || i >= EQUIPMENT_GRADES.length - 1) return Infinity;
  return EQUIPMENT_EVOLVE_XP_BASE * Math.pow(2, i);
}

/** グレードごとのレベルあたり加算値。コモン0.001、ノーマル0.002、レア0.003... */
export function getEquipmentPerLevel(grade: EquipmentGrade): number {
  const gradeIndex = EQUIPMENT_GRADES.indexOf(grade);
  if (gradeIndex < 0) return 0;
  return (gradeIndex + 1) * 0.001;
}

/**
 * グレード・レベル・前グレード引き継ぎ基準値に応じた効果倍率。
 * 倍率 = effect_base + perLevel * level（進化でレベルは0になるが、effect_base に前グレード時点の倍率が入る）。
 * 例: コモンLv5 → 1+0.001*5=1.005。ノーマル進化後は effect_base=1.005, level=0 → 1.005。ノーマルLv8 → 1.005+0.002*8=1.021。
 */
export function equipmentEffectMultiplier(
  grade: EquipmentGrade,
  level: number,
  effectBase: number = 1
): number {
  const perLevel = getEquipmentPerLevel(grade);
  return effectBase + perLevel * level;
}

/**
 * 悠久のトレンチコート用。他装備と同じ perLevel を使い、加算ではなく減算するだけ。
 * 倍率 = effect_base - perLevel * level（下限0）。進化時はこの値を effect_base として引き継ぐ。
 */
export function timeDecayRateMultiplier(
  grade: EquipmentGrade,
  level: number,
  effectBase: number = 1
): number {
  const perLevel = getEquipmentPerLevel(grade);
  return Math.max(0, effectBase - perLevel * level);
}

/** 効果値の表示桁数（レベル2・4など低レベルでも進化が視認できるよう小数第3〜5位まで表示） */
const EFFECT_VALUE_DECIMALS = 5;

/**
 * 効果説明テンプレート内の [V] / [Vの60%] を実際の値で置換する。
 * value は effectInitialValue * equipmentEffectMultiplier(grade, level, effect_base) で算出済みの値。
 * 低レベルでも変化が分かるよう、小数は第5位まで表示する。
 */
export function formatEffectDescription(effectTemplate: string, value: number): string {
  if (!effectTemplate || !effectTemplate.includes('[V]')) return effectTemplate;
  const isPercent = effectTemplate.includes('[V]%');
  const isSeconds = effectTemplate.includes('[V]秒');
  const isPoints = effectTemplate.includes('[V]点');
  const formatOne = (v: number): string => {
    if (isPercent) return (v * 100).toFixed(3);
    if (isSeconds) return v.toFixed(EFFECT_VALUE_DECIMALS);
    if (isPoints) return v.toFixed(3);
    return v.toFixed(EFFECT_VALUE_DECIMALS);
  };
  const main = formatOne(value);
  let out = effectTemplate.replace(/\[Vの60%\]/g, formatOne(value * 0.6));
  out = out.replace(/\[V\]/g, main);
  return out;
}

const EQUIPMENT_IMAGE_BASE = '/equipment';

/**
 * 装備画像のパス（PNGのみ）。グレード指定時は /equipment/{id}_{grade}.png（例: rensa_glass_pen_common.png）
 * 未指定またはフォールバック用は /equipment/{id}.png
 *
 * 画像の配置: public/equipment/ に .png または .jpg を配置。
 * - {equipment_id}.png / .jpg … デフォルト（グレード別がない場合やフォールバック）
 * - {equipment_id}_common.png / .jpg  … コモン
 * - {equipment_id}_normal.png  … ノーマル（コモンから進化後）
 * - {equipment_id}_rare.png
 * - {equipment_id}_epic.png
 * - {equipment_id}_legendary.png
 * - {equipment_id}_eternal.png
 */
export function getEquipmentImagePath(
  equipmentId: string,
  grade?: EquipmentGrade | string | null
): string {
  if (grade && typeof grade === 'string' && /^(common|normal|rare|epic|legendary|eternal)$/.test(grade)) {
    return `${EQUIPMENT_IMAGE_BASE}/${equipmentId}_${grade}.png`;
  }
  return `${EQUIPMENT_IMAGE_BASE}/${equipmentId}.png`;
}

/** 装備排出: 1. 4スロットのどこが出るか 1/4 で抽選 → 2. そのスロット内で特性別に抽選 */
export function pickGachaEquipment(): EquipmentItem {
  const slot = SLOTS[Math.floor(Math.random() * 4)]!;
  const slotEquipments = GACHA_EQUIPMENT.filter((e) => e.slot === slot);
  const total = slotEquipments.reduce((s, it) => s + it.baseRate, 0);
  let r = Math.random() * total;
  for (const it of slotEquipments) {
    if (r < it.baseRate) return it;
    r -= it.baseRate;
  }
  return slotEquipments[slotEquipments.length - 1]!;
}

const SR_EQUIPMENTS = GACHA_EQUIPMENT.filter((e) => e.rarity === 'SR');

/** 天井時: SRをランダムで1つ確定 */
export function pickGachaEquipmentSR(): EquipmentItem {
  return SR_EQUIPMENTS[Math.floor(Math.random() * SR_EQUIPMENTS.length)]!;
}

/** 各装備の実排出率（スロット1/4 × スロット内確率） */
export function getEquipmentDisplayRate(eq: EquipmentItem): number {
  return (eq.baseRate / 100) * 25; // 25% = 1/4 スロット
}
