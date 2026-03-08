import { readFileSync } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { SignedDataVerifier, Environment, type JWSTransactionDecodedPayload } from '@apple/app-store-server-library';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';
import {
  getPackIdFromAppleProductId,
  getPlanIdFromAppleProductId,
  CHIP_PACK_CHIPS,
} from '@/lib/apple-iap';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const bundleId = process.env.APPLE_BUNDLE_ID ?? 'com.toeic-sigma.shun';
const appleRootCaPath = process.env.APPLE_ROOT_CA_PATH ?? '';
const appStoreEnvironment = process.env.APPLE_APP_STORE_ENVIRONMENT === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX;

/** 紹介者コード適用時チップ倍率（Stripe webhook と同様） */
const REFERRER_CHIP_MULTIPLIER = 1.3;

function loadAppleRootCerts(): Buffer[] {
  if (!appleRootCaPath) return [];
  try {
    const buf = readFileSync(appleRootCaPath);
    return [Buffer.from(buf)];
  } catch {
    return [];
  }
}

/**
 * POST: Apple IAP の取引（JWS）を検証し、チップ付与またはサブスク反映を行う。
 * body: { receipt: string } (StoreKit 2 の transaction.receipt / jwsRepresentation)
 * 二重付与防止: apple_transactions に transaction_id を記録。
 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const receipt = typeof body?.receipt === 'string' ? body.receipt.trim() : '';
    if (!receipt) {
      return NextResponse.json({ error: 'receipt が必要です' }, { status: 400 });
    }

    const rootCerts = loadAppleRootCerts();
    if (rootCerts.length === 0) {
      console.error('[shop/apple/verify] APPLE_ROOT_CA_PATH が未設定または読めません');
      return NextResponse.json({ error: 'Apple 検証の設定がありません' }, { status: 503 });
    }

    const verifier = new SignedDataVerifier(rootCerts, true, appStoreEnvironment, bundleId);
    let payload: JWSTransactionDecodedPayload;
    try {
      payload = await verifier.verifyAndDecodeTransaction(receipt);
    } catch (e) {
      console.error('[shop/apple/verify] verify failed', e);
      return NextResponse.json({ error: '取引の検証に失敗しました' }, { status: 400 });
    }

    const transactionId = payload.transactionId ?? '';
    const productId = payload.productId ?? '';
    if (!transactionId || !productId) {
      return NextResponse.json({ error: '無効な取引データです' }, { status: 400 });
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: existing } = await adminSupabase
      .from('apple_transactions')
      .select('transaction_id')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, alreadyProcessed: true });
    }

    const packId = getPackIdFromAppleProductId(productId);
    const planId = getPlanIdFromAppleProductId(productId);

    if (packId !== null) {
      const chipsToGrant = CHIP_PACK_CHIPS[packId] ?? 0;
      if (chipsToGrant <= 0) {
        return NextResponse.json({ error: '不明なチップ商品です' }, { status: 400 });
      }
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('gems, referrer_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const hasReferrer = Boolean((profile as { referrer_id?: string | null })?.referrer_id?.trim());
      const chips = hasReferrer ? Math.floor(chipsToGrant * REFERRER_CHIP_MULTIPLIER) : chipsToGrant;
      const currentGems = Math.max(0, (profile as { gems?: number })?.gems ?? 0);
      const newGems = currentGems + chips;
      const now = new Date().toISOString();

      await adminSupabase.from('apple_transactions').insert({
        transaction_id: transactionId,
        user_id: user.id,
        product_id: productId,
        granted_at: now,
      });
      const { error: updateErr } = await adminSupabase
        .from('profiles')
        .update({ gems: newGems, updated_at: now })
        .eq('user_id', user.id);

      if (updateErr) {
        console.error('[shop/apple/verify] update gems', updateErr);
        return NextResponse.json({ error: 'チップの付与に失敗しました' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, chips: newGems });
    }

    if (planId === 'pro' || planId === 'ultra') {
      const expiresDate = payload.expiresDate;
      const expiresAt = expiresDate ? new Date(expiresDate).toISOString() : null;
      const now = new Date().toISOString();

      await adminSupabase.from('apple_transactions').insert({
        transaction_id: transactionId,
        user_id: user.id,
        product_id: productId,
        granted_at: now,
      });

      const updatePayload: Record<string, unknown> = {
        is_subscriber: true,
        subscription_tier: planId,
        updated_at: now,
      };
      if (expiresAt) updatePayload.apple_subscription_expires_at = expiresAt;

      const { error: updateErr } = await adminSupabase
        .from('profiles')
        .update(updatePayload)
        .eq('user_id', user.id);

      if (updateErr) {
        console.error('[shop/apple/verify] update subscription', updateErr);
        return NextResponse.json({ error: 'サブスクの反映に失敗しました' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, subscriptionTier: planId });
    }

    return NextResponse.json({ error: '未対応の商品です' }, { status: 400 });
  } catch (err) {
    console.error('[shop/apple/verify]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
