/**
 * 装備装着時の効果値を算出する。
 * ゲーム側はこの値を参照してスコア・時間・コンボ等に反映する。
 */

import {
  GACHA_EQUIPMENT,
  equipmentEffectMultiplier,
  timeDecayRateMultiplier,
  type EquipmentGrade,
} from '@/lib/equipment-items';

export type EquippedSlot = {
  equipment_id: string;
  grade: string;
  level: number;
  effect_base: number;
};

export type EquippedState = {
  weapon: EquippedSlot | null;
  head: EquippedSlot | null;
  torso: EquippedSlot | null;
  feet: EquippedSlot | null;
};

/** ゲーム内で参照する効果値の型。装備していないキーは undefined */
export type EquipmentEffects = Partial<{
  // 連鎖の万年筆
  combo_bonus_multiplier: number;
  combo_bonus_trigger_combo: number;
  // 黄金のシーリングスタンプ
  score_add_rate: number;
  // 熟練の蛍光マーカー
  xp_add_rate: number;
  // 延命の修正テープ
  recovery_sec_per_5: number;
  recovery_sec_interval: number;
  // 運命の羽ペン
  fate_heaven_multiplier: number;
  fate_hell_multiplier: number;
  // 逆境のモノクル
  reversal_recovery_multiplier: number;
  reversal_trigger_sec: number;
  // 学者の角帽
  combo_resume_multiplier: number;
  // 英知のヘッドセット
  minute_bonus_coefficient: number;
  minute_interval_sec: number;
  // 洞察のサンバイザー
  periodic_add_sec: number;
  periodic_interval_sec: number;
  // 預言者のバンダナ
  prophecy_multiplier: number;
  prophecy_hell_multiplier: number;
  prophecy_interval_sec: number;
  // 土俵際のブレザー
  last_stand_sec: number;
  // 栄光のタキシード
  glory_stack_per_10: number;
  glory_max_stacks: number;
  // 成長のドレス
  growth_ex_per_10: number;
  growth_max_stacks: number;
  // 悠久のトレンチコート
  time_decay_rate: number;
  // 鉄火場のシルクシャツ
  tekka_buff_rate: number;
  tekka_instant_death_chance: number;
  // 追撃のヒール
  evolution_buff_multiplier: number;
  evolution_buff_sec: number;
  // 繁栄のローファー
  final_bonus_coefficient: number;
  // 飛躍のトラックスパイク
  speed_multiplier_super: number;
  speed_multiplier_fast_ratio: number;
  speed_super_sec: number;
  speed_fast_sec: number;
  // 維持のコンプレッションソックス
  auto_recovery_sec: number;
  auto_recovery_interval_sec: number;
  // 韋駄天の下駄
  idaten_add_sec: number;
  idaten_subtract_sec: number;
  idaten_interval_sec: number;
}>;

const SLOTS = ['weapon', 'head', 'torso', 'feet'] as const;

/** 効果キーごとにどの装備が効いているかの出所（効果発動ポップアップ用） */
export type EffectSource = { equipmentId: string; grade: string; slot: string };
export type EquipmentEffectSources = Partial<Record<keyof EquipmentEffects, EffectSource>>;

function parseGrade(g: string): EquipmentGrade {
  if (['common', 'normal', 'rare', 'epic', 'legendary', 'eternal'].includes(g)) {
    return g as EquipmentGrade;
  }
  return 'common';
}

/**
 * 装着中の4スロットから、効果キーごとの出所（装備ID・グレード・スロット）を返す。効果発動ポップアップ用。
 */
export function getEquipmentEffectSources(equipped: EquippedState): EquipmentEffectSources {
  const sources: EquipmentEffectSources = {};
  const byId = new Map(GACHA_EQUIPMENT.map((e) => [e.id, e]));
  for (const slot of SLOTS) {
    const eq = equipped[slot];
    if (!eq) continue;
    const def = byId.get(eq.equipment_id);
    if (!def?.effectKey || def.effectInitialValue == null) continue;
    const key = def.effectKey as keyof EquipmentEffects;
    if (!sources[key]) sources[key] = { equipmentId: eq.equipment_id, grade: eq.grade, slot };
  }
  return sources;
}

/**
 * 装着中の4スロットから、ゲームで使う効果値オブジェクトを算出する。
 * 未装備の効果は含まれない。
 */
export function getEquipmentEffects(equipped: EquippedState): EquipmentEffects {
  const out: EquipmentEffects = {};
  const byId = new Map(GACHA_EQUIPMENT.map((e) => [e.id, e]));

  for (const slot of SLOTS) {
    const eq = equipped[slot];
    if (!eq) continue;
    const def = byId.get(eq.equipment_id);
    if (!def?.effectKey || def.effectInitialValue == null) continue;

    const grade = parseGrade(eq.grade);
    const mult = equipmentEffectMultiplier(grade, eq.level, eq.effect_base);
    const value = def.effectInitialValue * mult;

    switch (def.effectKey) {
      case 'combo_bonus_multiplier':
        out.combo_bonus_multiplier = value;
        out.combo_bonus_trigger_combo = def.effectConstant ?? 10;
        break;
      case 'score_add_rate':
        out.score_add_rate = value;
        break;
      case 'xp_add_rate':
        out.xp_add_rate = value;
        break;
      case 'recovery_sec_per_5':
        out.recovery_sec_per_5 = value;
        out.recovery_sec_interval = def.effectConstant ?? 5;
        break;
      case 'fate_heaven_multiplier':
        out.fate_heaven_multiplier = value;
        out.fate_hell_multiplier = def.effectConstant ?? -3;
        break;
      case 'reversal_recovery_multiplier':
        out.reversal_recovery_multiplier = value;
        out.reversal_trigger_sec = def.effectConstant ?? 10;
        break;
      case 'combo_resume_multiplier':
        out.combo_resume_multiplier = value;
        break;
      case 'minute_bonus_coefficient':
        out.minute_bonus_coefficient = value;
        out.minute_interval_sec = def.effectConstant ?? 60;
        break;
      case 'periodic_add_sec':
        out.periodic_add_sec = value;
        out.periodic_interval_sec = def.effectConstant ?? 60;
        break;
      case 'prophecy_multiplier':
        out.prophecy_multiplier = value;
        out.prophecy_hell_multiplier = def.effectConstant ?? 0.5;
        out.prophecy_interval_sec = 60;
        break;
      case 'last_stand_sec':
        out.last_stand_sec = value;
        break;
      case 'glory_stack_per_10':
        out.glory_stack_per_10 = value;
        out.glory_max_stacks = def.effectConstant ?? 10;
        break;
      case 'growth_ex_per_10':
        out.growth_ex_per_10 = value;
        out.growth_max_stacks = def.effectConstant ?? 10;
        break;
      case 'time_decay_rate': {
        // 悠久のトレンチコート: 他装備と同じ perLevel で「減算」するだけ（増加率を揃えている）。
        const mult = timeDecayRateMultiplier(grade, eq.level, eq.effect_base);
        out.time_decay_rate = (def.effectInitialValue ?? 0.9) * mult;
        break;
      }
      case 'tekka_buff_rate':
        out.tekka_buff_rate = value;
        out.tekka_instant_death_chance = def.effectConstant ?? 0.5;
        break;
      case 'evolution_buff_multiplier':
        out.evolution_buff_multiplier = value;
        out.evolution_buff_sec = def.effectConstant ?? 30;
        break;
      case 'final_bonus_coefficient':
        out.final_bonus_coefficient = value;
        break;
      case 'speed_multiplier_super':
        out.speed_multiplier_super = value;
        out.speed_multiplier_fast_ratio = def.effectConstant ?? 0.6;
        out.speed_super_sec = 1.5;
        out.speed_fast_sec = 3;
        break;
      case 'auto_recovery_sec':
        out.auto_recovery_sec = value;
        out.auto_recovery_interval_sec = def.effectConstant ?? 15;
        break;
      case 'idaten_add_sec':
        out.idaten_add_sec = value;
        out.idaten_subtract_sec = def.effectConstant ?? 30;
        out.idaten_interval_sec = 60;
        break;
      default:
        break;
    }
  }

  return out;
}
