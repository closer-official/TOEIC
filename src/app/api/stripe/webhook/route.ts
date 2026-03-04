import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getMaxStamina, computeCurrentStamina, type SubscriptionTier } from '@/lib/stamina';


export const dynamic = 'force-static';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
/** Webhook: STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY 必須。Stripe ダッシュボードでイベント checkout.session.completed を /api/stripe/webhook に送信 */
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const STRIPE_PRICE_ULTRA = process.env.STRIPE_PRICE_ULTRA ?? '';
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO ?? '';
const CHIPS_BY_TIER: Record<string, number> = { pro: 1000, ultra: 2000 };

/** 紹介者コード適用ユーザー: 購入で得られるチップの倍率（1.3 = 30%増） */
const REFERRER_CHIP_MULTIPLIER = 1.3;

function applyReferrerBonus(chips: number, hasReferrerCode: boolean): number {
  if (!hasReferrerCode || chips <= 0) return chips;
  return Math.floor(chips * REFERRER_CHIP_MULTIPLIER);
}

/** Stripe Webhook: checkout.session.completed でチップを付与（二重付与防止あり） */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  if (!stripeSecretKey || !stripeWebhookSecret) {
    console.error('[stripe webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeSecretKey);
    event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe webhook] signature verification failed', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // サブスク解約（翌月末で失効）: プロフィールをゲストに戻す
  if (event.type === 'customer.subscription.deleted') {
    if (!supabaseServiceRoleKey) {
      console.error('[stripe webhook] SUPABASE_SERVICE_ROLE_KEY missing');
      return NextResponse.json({ error: 'Server config missing' }, { status: 500 });
    }
    const sub = event.data.object as Stripe.Subscription;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { error } = await supabase
      .from('profiles')
      .update({
        is_subscriber: false,
        subscription_tier: null,
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', sub.id);
    if (error) console.error('[stripe webhook] subscription.deleted update profiles', error);
    else console.log('[stripe webhook] subscription.deleted', { subscriptionId: sub.id });
    return NextResponse.json({ received: true });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  let session = event.data.object as Stripe.Checkout.Session;
  let userId = session.client_reference_id ?? session.metadata?.user_id;
  console.log('[stripe webhook] checkout.session.completed', { sessionId: session.id, mode: session.mode, clientRefId: session.client_reference_id });

  // サブスク時: 常に subscription を expand。メタデータは Subscription に確実に付与される
  if (session.mode === 'subscription' && session.subscription) {
    try {
      const stripe = new Stripe(stripeSecretKey);
      const expanded = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['subscription'],
      });
      session = expanded as Stripe.Checkout.Session;
      const sub = session.subscription as Stripe.Subscription | undefined;
      if (sub?.metadata?.user_id) userId = userId ?? sub.metadata.user_id;
    } catch (e) {
      console.error('[stripe webhook] expand subscription', e);
    }
  }

  if (!supabaseServiceRoleKey) {
    console.error('[stripe webhook] SUPABASE_SERVICE_ROLE_KEY missing');
    return NextResponse.json({ error: 'Server config missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // サブスクリプション申込完了: ランク更新 + 初回チップ付与
  // user_id: client_reference_id を最優先（当APIで作成したセッションでは必ず設定している）
  // tier/chips: メタデータ → なければサブスクの price ID で判定（メタデータが付かなくても確実に反映）
  if (session.mode === 'subscription') {
    const sub = session.subscription as Stripe.Subscription | undefined;
    const subMeta = sub?.metadata ?? {};
    const sessionMeta = session.metadata ?? {};
    const uid = userId ?? sessionMeta.user_id ?? subMeta.user_id;
    if (!uid) {
      console.error('[stripe webhook] subscription missing user id', session.id, 'session.metadata=', sessionMeta, 'sub.metadata=', subMeta);
      return NextResponse.json({ received: true });
    }

    let tier: 'pro' | 'ultra' = 'pro';
    let chips = 0;
    const tierRaw = sessionMeta.tier ?? subMeta.plan_id;
    if (tierRaw === 'ultra') {
      tier = 'ultra';
      chips = typeof subMeta.chips === 'string' ? parseInt(subMeta.chips, 10) : CHIPS_BY_TIER.ultra;
    } else if (tierRaw === 'pro') {
      tier = 'pro';
      chips = typeof subMeta.chips === 'string' ? parseInt(subMeta.chips, 10) : CHIPS_BY_TIER.pro;
    } else {
      // メタデータが無い場合: サブスクの price ID で判定
      const priceRaw = sub?.items?.data?.[0]?.price;
      const priceIdStr = typeof priceRaw === 'string'
        ? priceRaw
        : (priceRaw && typeof priceRaw === 'object' && 'id' in priceRaw ? String((priceRaw as { id?: string }).id ?? '') : '');
      if (STRIPE_PRICE_ULTRA && priceIdStr === STRIPE_PRICE_ULTRA) {
        tier = 'ultra';
        chips = CHIPS_BY_TIER.ultra;
      } else if (STRIPE_PRICE_PRO && priceIdStr === STRIPE_PRICE_PRO) {
        tier = 'pro';
        chips = CHIPS_BY_TIER.pro;
      } else {
        chips = CHIPS_BY_TIER.pro;
      }
    }
    if (chips <= 0) chips = tier === 'ultra' ? CHIPS_BY_TIER.ultra : CHIPS_BY_TIER.pro;
    console.log('[stripe webhook] subscription apply', { uid, tier, chips });

    const { data: profile, error: selectErr } = await supabase
      .from('profiles')
      .select('gems, stamina_count, last_stamina_at, subscription_tier, referrer_id')
      .eq('user_id', uid)
      .single();

    if (selectErr || !profile) {
      console.error('[stripe webhook] subscription select profiles', selectErr);
      return NextResponse.json({ error: 'Profile not found' }, { status: 500 });
    }

    const hasReferrerCode = Boolean((profile as { referrer_id?: string | null }).referrer_id?.trim());
    const rawChips = Number.isInteger(chips) && chips > 0 ? chips : 0;
    const addChips = applyReferrerBonus(rawChips, hasReferrerCode);
    if (hasReferrerCode && rawChips > 0) {
      console.log('[stripe webhook] referrer bonus', { rawChips, addChips });
    }
    const currentGems = Math.max(0, (profile as { gems?: number }).gems ?? 0);
    const now = new Date().toISOString();

    const { error: insertErr } = await supabase.from('stripe_chip_fulfilled').insert({
      stripe_session_id: session.id,
      user_id: uid,
      chips: addChips,
    });
    if (insertErr) {
      if (insertErr.code === '23505') return NextResponse.json({ received: true });
      console.error('[stripe webhook] subscription insert', insertErr);
      return NextResponse.json({ error: 'Fulfillment failed' }, { status: 500 });
    }

    const prevTier = ((profile as { subscription_tier?: string | null }).subscription_tier === 'pro' || (profile as { subscription_tier?: string | null }).subscription_tier === 'ultra')
      ? (profile as { subscription_tier: string }).subscription_tier as SubscriptionTier
      : 'free';
    const prevMax = getMaxStamina(prevTier);
    const newMax = getMaxStamina(tier);
    const staminaDelta = Math.max(0, newMax - prevMax);
    const { stamina: currentStamina } = computeCurrentStamina(
      (profile as { stamina_count?: number }).stamina_count ?? 0,
      (profile as { last_stamina_at?: string | null }).last_stamina_at ?? null,
      prevTier,
      0,
      1
    );
    const newStaminaCount = Math.min(newMax, currentStamina + staminaDelta);

    const subId = typeof (session.subscription as Stripe.Subscription | string) === 'string'
      ? (session.subscription as string)
      : (session.subscription as Stripe.Subscription)?.id ?? null;

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        gems: currentGems + addChips,
        is_subscriber: true,
        subscription_tier: tier,
        ...(subId ? { stripe_subscription_id: subId } : {}),
        stamina_count: newStaminaCount,
        last_stamina_at: now,
        updated_at: now,
      })
      .eq('user_id', uid);

    if (updateErr) {
      console.error('[stripe webhook] subscription update profiles', updateErr);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
    console.log('[stripe webhook] subscription done', { uid, tier });
    return NextResponse.json({ received: true });
  }

  // チップ一括購入
  const rawChips = session.metadata?.chips ? parseInt(session.metadata.chips, 10) : 0;
  if (!userId || !Number.isInteger(rawChips) || rawChips <= 0) {
    console.error('[stripe webhook] missing userId or invalid chips', { userId, chips: rawChips });
    return NextResponse.json({ received: true });
  }

  const { data: profile, error: selectErr } = await supabase
    .from('profiles')
    .select('gems, referrer_id')
    .eq('user_id', userId)
    .single();

  if (selectErr || !profile) {
    console.error('[stripe webhook] select profiles', selectErr);
    return NextResponse.json({ error: 'Profile not found' }, { status: 500 });
  }

  const hasReferrerCode = Boolean((profile as { referrer_id?: string | null }).referrer_id?.trim());
  const chips = applyReferrerBonus(rawChips, hasReferrerCode);

  const { error: insertErr } = await supabase.from('stripe_chip_fulfilled').insert({
    stripe_session_id: session.id,
    user_id: userId,
    chips,
  });

  if (insertErr) {
    if (insertErr.code === '23505') return NextResponse.json({ received: true });
    console.error('[stripe webhook] insert stripe_chip_fulfilled', insertErr);
    return NextResponse.json({ error: 'Fulfillment failed' }, { status: 500 });
  }

  const currentGems = Math.max(0, (profile as { gems?: number }).gems ?? 0);
  const newGems = currentGems + chips;
  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ gems: newGems, updated_at: now })
    .eq('user_id', userId);

  if (updateErr) {
    console.error('[stripe webhook] update profiles gems', updateErr);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
