/**
 * Apple IAP（StoreKit 2）用の商品IDマッピングと定数。
 * App Store Connect ではウェブ版価格の 1.3 倍（30% 上乗せ）で登録すること。
 */

export const APPLE_BUNDLE_ID = 'com.toeic-sigma.shun';

const CHIP_PREFIX = `${APPLE_BUNDLE_ID}.chips.`;
const SUBSCRIPTION_PREFIX = `${APPLE_BUNDLE_ID}.subscription.`;

/** チップパックID（ウェブの packId）→ Apple 商品ID */
export const APPLE_CHIP_PRODUCT_IDS: Record<string, string> = {
  mini: `${CHIP_PREFIX}mini`,
  small: `${CHIP_PREFIX}small`,
  medium: `${CHIP_PREFIX}medium`,
  large: `${CHIP_PREFIX}large`,
  xl: `${CHIP_PREFIX}xl`,
  xxl: `${CHIP_PREFIX}xxl`,
};

/** サブスクプランID（pro / ultra）→ Apple 商品ID */
export const APPLE_SUBSCRIPTION_PRODUCT_IDS: Record<string, string> = {
  pro: `${SUBSCRIPTION_PREFIX}pro`,
  ultra: `${SUBSCRIPTION_PREFIX}ultra`,
};

/** 全チップ商品ID（getProducts 用） */
export const ALL_APPLE_CHIP_PRODUCT_IDS = Object.values(APPLE_CHIP_PRODUCT_IDS);

/** 全サブスク商品ID（getProducts 用） */
export const ALL_APPLE_SUBSCRIPTION_PRODUCT_IDS = Object.values(APPLE_SUBSCRIPTION_PRODUCT_IDS);

/** Apple 商品ID から packId を取得（チップの場合） */
export function getPackIdFromAppleProductId(productId: string): string | null {
  if (!productId.startsWith(CHIP_PREFIX)) return null;
  const suffix = productId.slice(CHIP_PREFIX.length);
  return APPLE_CHIP_PRODUCT_IDS[suffix] === productId ? suffix : null;
}

/** Apple 商品ID から planId を取得（サブスクの場合） */
export function getPlanIdFromAppleProductId(productId: string): 'pro' | 'ultra' | null {
  if (!productId.startsWith(SUBSCRIPTION_PREFIX)) return null;
  const suffix = productId.slice(SUBSCRIPTION_PREFIX.length);
  if (suffix === 'pro' || suffix === 'ultra') return suffix;
  return null;
}

/** ウェブ版チップ価格（円）。App Store Connect ではこの 1.3 倍で設定する。 */
export const CHIP_PACKS_WEB_PRICE: Record<string, number> = {
  mini: 50,
  small: 500,
  medium: 1000,
  large: 3000,
  xl: 5000,
  xxl: 10000,
};

/** ウェブ版サブスク月額（円）。App Store Connect ではこの 1.3 倍で設定する。 */
export const SUBSCRIPTION_WEB_PRICE: Record<string, number> = {
  pro: 800,
  ultra: 1500,
};

/** チップパックごとの付与チップ数（packId → chips）。サーバー検証で使用。 */
export const CHIP_PACK_CHIPS: Record<string, number> = {
  mini: 200,
  small: 2200,
  medium: 5000,
  large: 16000,
  xl: 28000,
  xxl: 60000,
};

/** App Store 用表示価格（30% 上乗せ）。ストアから取得した priceString をそのまま表示する場合は不要。 */
export function getAppStorePriceYen(webPriceYen: number): number {
  return Math.round(webPriceYen * 1.3);
}
