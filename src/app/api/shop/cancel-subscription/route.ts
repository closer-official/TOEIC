import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

/** POST: サブスクを翌月末で解約（cancel_at_period_end = true） */
export async function POST() {
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
        setAll() {},
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'プロフィールを取得できませんでした' }, { status: 500 });
    }

    const subId = (profile as { stripe_subscription_id?: string | null }).stripe_subscription_id;
    if (!subId || typeof subId !== 'string') {
      return NextResponse.json({ error: '解約対象のサブスクリプションがありません' }, { status: 400 });
    }

    const stripe = new Stripe(stripeSecretKey);
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true });

    return NextResponse.json({ ok: true, message: '翌月末で解約されます' });
  } catch (err) {
    console.error('[shop cancel-subscription]', err);
    return NextResponse.json({ error: '解約の処理に失敗しました' }, { status: 500 });
  }
}
