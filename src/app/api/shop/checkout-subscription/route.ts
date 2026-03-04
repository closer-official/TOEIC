import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/** プランID → Stripe Price ID・表示名・付与チップ（Proで0.5天井・VIPで1天井） */
const SUBSCRIPTION_PLANS: Record<string, { priceId: string; name: string; chips: number }> = {
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO ?? '',
    name: 'Pro',
    chips: 2500,
  },
  ultra: {
    priceId: process.env.STRIPE_PRICE_ULTRA ?? '',
    name: 'VIP',
    chips: 5000,
  },
};

/** POST: サブスクリプション（メンバー/VIP）の Stripe Checkout セッションを作成。body: { planId: 'pro' | 'ultra' }。戻り値: { url } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  if (!stripeSecretKey) {
    return NextResponse.json({ error: '決済機能は現在設定中です' }, { status: 503 });
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const planId = typeof body?.planId === 'string' ? body.planId : '';
    const plan = planId === 'pro' || planId === 'ultra' ? SUBSCRIPTION_PLANS[planId] : null;
    if (!plan || !plan.priceId) {
      return NextResponse.json({ error: '無効なプランです。管理者に STRIPE_PRICE_PRO / STRIPE_PRICE_ULTRA の設定を確認してください。' }, { status: 400 });
    }

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/shop?success=1`,
      cancel_url: `${baseUrl}/shop?cancel=1`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        planId,
        tier: planId,
        chips: String(plan.chips),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: planId,
          chips: String(plan.chips),
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Checkout の作成に失敗しました' }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[shop checkout-subscription]', err);
    return NextResponse.json({ error: '決済の開始に失敗しました' }, { status: 500 });
  }
}
