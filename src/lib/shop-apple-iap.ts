'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ALL_APPLE_CHIP_PRODUCT_IDS,
  ALL_APPLE_SUBSCRIPTION_PRODUCT_IDS,
  APPLE_CHIP_PRODUCT_IDS,
  APPLE_SUBSCRIPTION_PRODUCT_IDS,
} from '@/lib/apple-iap';

export type IapChipProduct = {
  productIdentifier: string;
  priceString: string;
  chips: number;
  packId: string;
};

export type IapSubProduct = {
  productIdentifier: string;
  priceString: string;
  planId: 'pro' | 'ultra';
};

/** ウェブの CHIP_PACKS の chips 数（packId 対応） */
const CHIPS_BY_PACK_ID: Record<string, number> = {
  mini: 200,
  small: 2200,
  medium: 5000,
  large: 16000,
  xl: 28000,
  xxl: 60000,
};

export function useIsAppStore(): boolean {
  const [is, setIs] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NEXT_PUBLIC_CAPACITOR_APP !== '1') return;
    import('@capacitor/core').then(({ Capacitor }) => {
      setIs(Capacitor.getPlatform() === 'ios');
    }).catch(() => {});
  }, []);
  return is;
}

export function useAppleIapProducts(): {
  chipProducts: IapChipProduct[];
  subProducts: IapSubProduct[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [chipProducts, setChipProducts] = useState<IapChipProduct[]>([]);
  const [subProducts, setSubProducts] = useState<IapSubProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
      const { isBillingSupported } = await NativePurchases.isBillingSupported();
      if (!isBillingSupported) {
        setError('お使いの環境では課金を利用できません');
        setLoading(false);
        return;
      }
      const [chipRes, subRes] = await Promise.all([
        NativePurchases.getProducts({
          productIdentifiers: ALL_APPLE_CHIP_PRODUCT_IDS,
          productType: PURCHASE_TYPE.INAPP,
        }),
        NativePurchases.getProducts({
          productIdentifiers: ALL_APPLE_SUBSCRIPTION_PRODUCT_IDS,
          productType: PURCHASE_TYPE.SUBS,
        }),
      ]);
      const chips: IapChipProduct[] = [];
      for (const p of chipRes.products ?? []) {
        const pid = (p as { productIdentifier?: string }).productIdentifier ?? '';
        const packId = Object.entries(APPLE_CHIP_PRODUCT_IDS).find(([, v]) => v === pid)?.[0];
        if (packId) {
          chips.push({
            productIdentifier: pid,
            priceString: (p as { priceString?: string }).priceString ?? `¥${0}`,
            chips: CHIPS_BY_PACK_ID[packId] ?? 0,
            packId,
          });
        }
      }
      const subs: IapSubProduct[] = [];
      for (const p of subRes.products ?? []) {
        const pid = (p as { productIdentifier?: string }).productIdentifier ?? '';
        const planId = Object.entries(APPLE_SUBSCRIPTION_PRODUCT_IDS).find(([, v]) => v === pid)?.[0] as 'pro' | 'ultra' | undefined;
        if (planId) {
          subs.push({
            productIdentifier: pid,
            priceString: (p as { priceString?: string }).priceString ?? `¥${0}`,
            planId,
          });
        }
      }
      setChipProducts(chips);
      setSubProducts(subs);
    } catch (e) {
      console.error('[shop-apple-iap] getProducts', e);
      setError('商品の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ok = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_CAPACITOR_APP === '1';
    if (!ok) {
      setLoading(false);
      return;
    }
    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.getPlatform() !== 'ios') {
        setLoading(false);
        return;
      }
      load();
    }).catch(() => setLoading(false));
  }, [load]);

  return { chipProducts, subProducts, loading, error, refresh: load };
}

export async function purchaseAppleChip(productIdentifier: string): Promise<{ receipt: string } | { error: string }> {
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier,
    productType: PURCHASE_TYPE.INAPP,
    quantity: 1,
  });
  const receipt = (transaction as { receipt?: string }).receipt;
  if (!receipt) return { error: '取引データの取得に失敗しました' };
  return { receipt };
}

export async function purchaseAppleSubscription(productIdentifier: string): Promise<{ receipt: string } | { error: string }> {
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier,
    planIdentifier: undefined,
    productType: PURCHASE_TYPE.SUBS,
    quantity: 1,
  });
  const receipt = (transaction as { receipt?: string }).receipt;
  if (!receipt) return { error: '取引データの取得に失敗しました' };
  return { receipt };
}

export async function openAppleSubscriptionManagement(): Promise<void> {
  const { NativePurchases } = await import('@capgo/native-purchases');
  await NativePurchases.manageSubscriptions();
}

export async function restoreApplePurchases(): Promise<{ verified: number; error?: string }> {
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
  await NativePurchases.restorePurchases();
  const [inAppRes, subRes] = await Promise.all([
    NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP }),
    NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS }),
  ]);
  const allReceipts: string[] = [];
  for (const p of inAppRes.purchases ?? []) {
    const r = (p as { receipt?: string }).receipt;
    if (r) allReceipts.push(r);
  }
  for (const p of subRes.purchases ?? []) {
    const r = (p as { receipt?: string }).receipt;
    if (r) allReceipts.push(r);
  }
  let verified = 0;
  for (const receipt of allReceipts) {
    try {
      const res = await fetch('/api/shop/apple/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receipt }),
      });
      if (res.ok) verified += 1;
    } catch {
      // ignore
    }
  }
  return { verified };
}
