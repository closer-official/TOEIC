/**
 * 所持アイテムからゲーム内効果値を集約する。
 * 装備と同様、ゲーム開始時に所持リストを渡して効果オブジェクトを得る。
 */

import { GACHA_ITEMS } from '@/lib/gacha-items';
import type { ItemEffectKey } from '@/lib/gacha-items';

export type ItemEffects = Partial<{
  /** 幸運のコイン: この確率でBPがbp_luck_mult倍になる */
  bp_luck_chance: number;
  bp_luck_mult: number;
  /** ミス時ペナルティ軽減%（5=5%軽減） */
  miss_penalty_reduce_pct: number;
  /** コンボ倍率の加算値（1+combo/10 に加算） */
  combo_bonus_add: number;
  /** EP（スコア換算）アップ% */
  ep_pct: number;
  /** Part5モードのみBPアップ% */
  bp_part5_pct: number;
  /** 単語全国のみBPアップ% */
  bp_vocab_pct: number;
  /** スピードボーナス倍率に加算 */
  speed_bonus_add: number;
  /** 50コンボ以上でスコアに加算% */
  combo50_score_pct: number;
  /** 開始時持ち時間に加算する秒数（合計） */
  initial_time_add_sec: number;
  /** 正解スコア倍率（諸刃・漆黒。複数所持時は最大を採用） */
  correct_score_mult: number;
  /** ミス時ペナルティ倍率（複数時は最大） */
  miss_penalty_mult: number;
  /** 回復の秘薬: 1回だけミス無効化 */
  potion_guard: number;
  /** コンボの女神像: この確率でミス時コンボ維持（0.5=50%） */
  combo_guard_chance: number;
  /** 正解時の時間回復倍率 */
  correct_time_mult: number;
  /** 不死鳥: タイムオーバー時1回だけこの秒数で復活 */
  phoenix_revive_sec: number;
  /** 知恵の王冠: 全問RARE以上BP扱い */
  crown_all_rare: number;
}>;

const byId = new Map(GACHA_ITEMS.map((it) => [it.id, it]));

/**
 * 所持アイテムIDリストから効果を集約する。
 * 加算系は合計、correct_score_mult / miss_penalty_mult は最大値を採用。
 */
export function getItemEffects(ownedItemIds: string[]): ItemEffects {
  const out: ItemEffects = {};
  let maxCorrectMult = 1;
  let maxMissMult = 1;

  for (const id of ownedItemIds) {
    const def = byId.get(id);
    if (!def?.effectValues) continue;
    for (const [key, value] of Object.entries(def.effectValues) as [ItemEffectKey, number][]) {
      if (value === undefined) continue;
      switch (key) {
        case 'correct_score_mult':
          maxCorrectMult = Math.max(maxCorrectMult, value);
          break;
        case 'miss_penalty_mult':
          maxMissMult = Math.max(maxMissMult, value);
          break;
        case 'final_score_pct':
          // 廃止: スコア倍率表示を廃止したため集計しない
          break;
        case 'potion_guard':
        case 'crown_all_rare':
        case 'phoenix_revive_sec':
          // 1つでも所持で有効（最大を取る＝上書き）
          (out as Record<string, number>)[key] = Math.max((out as Record<string, number>)[key] ?? 0, value);
          break;
        default:
          (out as Record<string, number>)[key] = ((out as Record<string, number>)[key] ?? 0) + value;
          break;
      }
    }
  }

  if (maxCorrectMult > 1) out.correct_score_mult = maxCorrectMult;
  if (maxMissMult > 1) out.miss_penalty_mult = maxMissMult;
  return out;
}
