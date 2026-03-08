/** ガチャレアリティ（装備に合わせて SR / R / N） */
export type GachaRarity = 'SR' | 'R' | 'N';

/** アイテム効果のゲーム内キー（item-effects で加算される） */
export type ItemEffectKey =
  | 'bp_luck_chance'
  | 'bp_luck_mult'
  | 'final_score_pct'
  | 'miss_penalty_reduce_pct'
  | 'combo_bonus_add'
  | 'ep_pct'
  | 'bp_part5_pct'
  | 'bp_vocab_pct'
  | 'speed_bonus_add'
  | 'combo50_score_pct'
  | 'initial_time_add_sec'
  | 'correct_score_mult'
  | 'miss_penalty_mult'
  | 'potion_guard'
  | 'combo_guard_chance'
  | 'correct_time_mult'
  | 'phoenix_revive_sec'
  | 'crown_all_rare';

export type GachaItem = {
  id: string;
  name: string;
  rarity: GachaRarity;
  /** 排出率（%）の基準値。会員で rateMultiplier がかかる。装備と統一感: N 約75%, R 約23%, SR 約2% */
  baseRate: number;
  /** 効果説明（排出一覧の ? で表示） */
  effect: string;
  /** ゲーム内で加算する効果値（所持1個以上で有効）。複数所持は重ねがけしない想定 */
  effectValues?: Partial<Record<ItemEffectKey, number>>;
};

/**
 * 全ガチャアイテム（N / R / SR）。※ルーレットでは廃止済み：装備のみ排出。
 * 既存インベントリ表示・取引所・アイテムの本（今後の別アイテム追加用）のために定義は残す。
 */
export const GACHA_ITEMS: GachaItem[] = [
  // 【N】約75%（8%×5 + 5%×7）
  { id: 'coin', name: '幸運のコイン', rarity: 'N', baseRate: 8, effect: '10%の確率でその問題の基礎点（BP）が1.2倍になる。', effectValues: { bp_luck_chance: 0.10, bp_luck_mult: 1.2 } },
  { id: 'bookmark', name: '単語の栞', rarity: 'N', baseRate: 8, effect: '最終スコアが1%アップする。', effectValues: { final_score_pct: 1 } },
  { id: 'eraser', name: '小さな消しゴム', rarity: 'N', baseRate: 8, effect: 'ミス時の時間減少ペナルティを5%軽減する。', effectValues: { miss_penalty_reduce_pct: 5 } },
  { id: 'nib', name: '予備のペン先', rarity: 'N', baseRate: 8, effect: 'コンボ倍率の加算値に +0.01 のボーナス。', effectValues: { combo_bonus_add: 0.01 } },
  { id: 'workbook', name: '練習問題集', rarity: 'N', baseRate: 8, effect: '獲得できる進化ポイント（EP）が5%アップする。', effectValues: { ep_pct: 5 } },
  { id: 'book', name: '知識の書', rarity: 'N', baseRate: 5, effect: '最終スコアが5%アップする。', effectValues: { final_score_pct: 5 } },
  { id: 'shield', name: '守りの盾', rarity: 'N', baseRate: 5, effect: 'ミス時の時間減少ペナルティを10%軽減する。', effectValues: { miss_penalty_reduce_pct: 10 } },
  { id: 'grammar_reminder', name: '文法リマインダー', rarity: 'N', baseRate: 5, effect: 'Part 5モードのみ、基礎点（BP）が10%アップする。', effectValues: { bp_part5_pct: 10 } },
  { id: 'word_memo', name: '単語速記帳', rarity: 'N', baseRate: 5, effect: '単語全国モードのみ、基礎点（BP）が10%アップする。', effectValues: { bp_vocab_pct: 10 } },
  { id: 'glasses', name: '集中メガネ', rarity: 'N', baseRate: 5, effect: 'スピードボーナスの倍率に +0.05 の固定加算。', effectValues: { speed_bonus_add: 0.05 } },
  { id: 'clip', name: '銀のクリップ', rarity: 'N', baseRate: 5, effect: '50コンボ以上の間、スコアがさらに5%アップする。', effectValues: { combo50_score_pct: 5 } },
  { id: 'alarm', name: 'ミニ目覚まし時計', rarity: 'N', baseRate: 5, effect: 'ゲーム開始時の持ち時間に +2秒 加算される。', effectValues: { initial_time_add_sec: 2 } },
  // 【R】約23%（2.5%×7 + 1.8%×3）
  { id: 'sword', name: '諸刃の剣', rarity: 'R', baseRate: 2.5, effect: '正解スコアが1.5倍になるが、ミス時のペナルティも1.5倍になる。', effectValues: { correct_score_mult: 1.5, miss_penalty_mult: 1.5 } },
  { id: 'potion', name: '回復の秘薬', rarity: 'R', baseRate: 2.5, effect: '1回だけミスを無効化し、時間減少とコンボリセットを防ぐ。', effectValues: { potion_guard: 1 } },
  { id: 'golden_pen', name: '黄金の羽ペン', rarity: 'R', baseRate: 2.5, effect: '最終スコアが10%アップする。', effectValues: { final_score_pct: 10 } },
  { id: 'hourglass', name: '時間の砂時計', rarity: 'R', baseRate: 2.5, effect: 'ゲーム開始時の持ち時間に +5秒 加算される。', effectValues: { initial_time_add_sec: 5 } },
  { id: 'combo_statue', name: 'コンボの女神像', rarity: 'R', baseRate: 2.5, effect: '50%の確率で、ミスしても一度だけコンボが維持される。', effectValues: { combo_guard_chance: 0.5 } },
  { id: 'black_ink', name: '漆黒のインク', rarity: 'R', baseRate: 2.5, effect: '正解スコアが1.7倍になるが、ミス時のペナルティが2倍になる（諸刃の強化版）。', effectValues: { correct_score_mult: 1.7, miss_penalty_mult: 2 } },
  { id: 'steel_dict', name: '鋼の辞書', rarity: 'R', baseRate: 2.5, effect: 'ミス時の時間減少を25%軽減する。', effectValues: { miss_penalty_reduce_pct: 25 } },
  { id: 'philosopher_stone', name: '賢者の石', rarity: 'R', baseRate: 1.8, effect: '最終スコアが20%アップする。', effectValues: { final_score_pct: 20 } },
  { id: 'chronos_clock', name: 'クロノスの時計', rarity: 'R', baseRate: 1.8, effect: '正解するたびに回復する時間が通常の1.2倍になる。', effectValues: { correct_time_mult: 1.2 } },
  { id: 'medal', name: '覇者のメダル', rarity: 'R', baseRate: 1.8, effect: '獲得できる進化ポイント（EP）が50%アップする。', effectValues: { ep_pct: 50 } },
  // 【SR】約2%（0.67%×3）
  { id: 'shun_secret', name: '瞬の極意', rarity: 'SR', baseRate: 0.67, effect: '最終スコア30%アップ ＋ コンボ倍率の加算値に +0.05 ボーナス。', effectValues: { final_score_pct: 30, combo_bonus_add: 0.05 } },
  { id: 'phoenix_feather', name: '不死鳥の羽根', rarity: 'SR', baseRate: 0.67, effect: 'タイムオーバーになっても一度だけ残り時間を5秒回復して復活する。', effectValues: { phoenix_revive_sec: 5 } },
  { id: 'crown', name: '知恵の王冠', rarity: 'SR', baseRate: 0.67, effect: '全ての問題が「RARE（難易度900）」以上の基礎点扱いになる。', effectValues: { crown_all_rare: 1 } },
  // 進化用素材（ガチャでは排出しない。すごろくのかけら10個で変換）
  { id: 'eternal_material', name: 'エターナル素材', rarity: 'SR', baseRate: 0, effect: 'レジェンダリー装備をエターナルに進化させる際に1個消費する。' },
  // 1番くじ・すごろくなどで取得。進化でエターナル素材に変換（10個で1個）またはラストワン賞
  { id: 'eternal_cross_fragment', name: 'エターナル・クロスの欠片', rarity: 'SR', baseRate: 0, effect: 'すごろくで10個集めるとエターナル素材1個に変換可能。1番くじのラストワン賞では欠片×3を獲得。' },
  // 1番くじB+賞などで取得。その場で使用可能。ギルド所属時はギルド全体、未所属時は自分だけ30分間2倍
  { id: 'xp_booster', name: 'XPブースター', rarity: 'SR', baseRate: 0, effect: '使うと30分間、獲得XPが2倍になる。ギルドに所属している場合はギルド全体、未所属の場合は自分にのみ有効。' },
];

/** id → 効果説明（ショップの排出一覧用） */
export const GACHA_ITEM_EFFECTS: Record<string, string> = Object.fromEntries(
  GACHA_ITEMS.map((it) => [it.id, it.effect])
);

/**
 * 重み付きで1体選ぶ（クライアント用デモ。本番はAPIで抽選する想定）
 */
export function pickGachaItem(rateMultiplier: number = 1): GachaItem {
  const total = GACHA_ITEMS.reduce((s, it) => s + it.baseRate * rateMultiplier, 0);
  let r = Math.random() * total;
  for (const it of GACHA_ITEMS) {
    const w = it.baseRate * rateMultiplier;
    if (r < w) return it;
    r -= w;
  }
  return GACHA_ITEMS[GACHA_ITEMS.length - 1]!;
}
