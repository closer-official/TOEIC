import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';


export const dynamic = 'force-static';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

/** GET: ?session_id=cs_xxx で Checkout セッションのステータスを返す。return ページ用 */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  try {
    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const email = session.customer_details?.email ?? session.customer_email ?? '';
    return NextResponse.json({
      status: session.status,
      customer_email: email,
    });
  } catch (err) {
    console.error('[shop session-status]', err);
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
}
