import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/** チップ購入パック（月1000円で1天井=5000チップを基準） */
const CHIP_PACKS: { id: string; chips: number; price: number }[] = [
  { id: 'mini', chips: 200, price: 50 },
  { id: 'small', chips: 2200, price: 500 },
  { id: 'medium', chips: 5000, price: 1000 },
  { id: 'large', chips: 16000, price: 3000 },
  { id: 'xl', chips: 28000, price: 5000 },
  { id: 'xxl', chips: 60000, price: 10000 },
];

/** POST: 埋め込み Checkout 用セッション作成。body: { packId }。戻り値: { clientSecret } */
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
    const packId = typeof body?.packId === 'string' ? body.packId : '';
    const pack = CHIP_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: '無効なチップパックです' }, { status: 400 });
    }

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'jpy',
            unit_amount: pack.price,
            product_data: {
              name: `${pack.chips.toLocaleString()} チップ`,
              description: 'All-in ENGLISH ショップ - チップ購入',
            },
          },
        },
      ],
      return_url: `${baseUrl}/shop?session_id={CHECKOUT_SESSION_ID}`,
      client_reference_id: user.id,
      metadata: {
        packId: pack.id,
        chips: String(pack.chips),
      },
    });

    if (!session.client_secret) {
      return NextResponse.json({ error: 'Checkout の作成に失敗しました' }, { status: 500 });
    }
    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('[shop checkout embedded]', err);
    return NextResponse.json({ error: '決済の開始に失敗しました' }, { status: 500 });
  }
}
