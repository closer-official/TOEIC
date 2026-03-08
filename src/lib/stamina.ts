/** スタミナ上限: 無課金50、Pro100、Ultra200 */
export const STAMINA_MAX_FREE = 50;
export const STAMINA_MAX_PRO = 100;
export const STAMINA_MAX_ULTRA = 200;

export type SubscriptionTier = 'free' | 'pro' | 'ultra';

/** プランごとのスタミナ上限 */
export function getMaxStamina(tier: SubscriptionTier): number {
  switch (tier) {
    case 'pro': return STAMINA_MAX_PRO;
    case 'ultra': return STAMINA_MAX_ULTRA;
    default: return STAMINA_MAX_FREE;
  }
}

/** 1プレイあたりの消費量（デフォルト・従来互換） */
export const STAMINA_CONSUME = 5;

/** 選択可能な消費量（5刻み・最大25） */
export const STAMINA_CONSUME_OPTIONS = [5, 10, 15, 20, 25] as const;
export const STAMINA_CONSUME_MAX = 25;

/** 消費スタミナに対するXP倍率（傾斜）。5→1.0、まとめ消費で効率ダウン。スコアは等倍のまま。 */
const XP_MULT_BY_STAMINA: Record<number, number> = {
  5: 1.0,
  10: 1.9,
  15: 2.7,
  20: 3.4,
  25: 4.0,
};

export function getXpMultiplierForStamina(amount: number): number {
  const n = Number(amount);
  if (Number.isFinite(n) && XP_MULT_BY_STAMINA[n] != null) return XP_MULT_BY_STAMINA[n];
  return XP_MULT_BY_STAMINA[STAMINA_CONSUME] ?? 1;
}

export function isValidStaminaConsumeAmount(amount: unknown): amount is 5 | 10 | 15 | 20 | 25 {
  return typeof amount === 'number' && STAMINA_CONSUME_OPTIONS.includes(amount as 5 | 10 | 15 | 20 | 25);
}
/** 0→Max回復に要する時間（24時間）ms */
const RECOVERY_FULL_MS = 24 * 60 * 60 * 1000;
const MIN_RECOVERY_INTERVAL_MS = 60 * 1000;

/**
 * 現在スタミナを算出（サーバー・クライアント共用）
 * @param staminaCount DBのstamina_count（最後に記録した値）
 * @param lastStaminaAt DBのlast_stamina_at（その時刻）
 * @param subscriptionTier 会員プラン（free / pro / ultra）
 * @param evolutionStaminaBonus 進化ボーナス（最大スタミナ加算、省略時0）
 * @param recoverySpeedMultiplier 魂の燃焼: 回復速度倍率 1.0〜1.10（1=100%, 1.01=1%早い）。省略時1
 */
export function computeCurrentStamina(
  staminaCount: number,
  lastStaminaAt: string | null,
  subscriptionTier: SubscriptionTier,
  evolutionStaminaBonus: number = 0,
  recoverySpeedMultiplier: number = 1
): { stamina: number; nextRecoveryAt: number | null } {
  const max = getMaxStamina(subscriptionTier) + evolutionStaminaBonus;
  const baseIntervalMs = Math.floor(RECOVERY_FULL_MS / max);
  const mult = Math.max(0.01, Math.min(1.5, recoverySpeedMultiplier));
  const recoveryIntervalMs = Math.max(MIN_RECOVERY_INTERVAL_MS, baseIntervalMs / mult);

  let lastAt = lastStaminaAt ? new Date(lastStaminaAt).getTime() : Date.now();
  const now = Date.now();
  const elapsed = Math.max(0, now - lastAt);
  const gained = Math.floor(elapsed / recoveryIntervalMs);
  const current = Math.min(max, staminaCount + gained);

  if (current >= max) {
    return { stamina: max, nextRecoveryAt: null };
  }
  const remainder = elapsed % recoveryIntervalMs;
  const nextRecoveryAt = now + (recoveryIntervalMs - remainder);
  return { stamina: current, nextRecoveryAt };
}
