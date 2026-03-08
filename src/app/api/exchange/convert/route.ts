import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** 1 XP = 0.01 チップ（100 XP = 1 チップ） */
const GEMS_PER_XP = 0.01;

/** POST: XP → チップ交換。body: { amount: number }。1 XP = 0.01 チップ */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const amount = Math.floor(Number(body?.amount ?? 0));
    if (amount <= 0) {
      return NextResponse.json({ error: '交換量を指定してください' }, { status: 400 });
    }

    const adminSupabase = supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey)
      : supabase;

    const { data: profile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('evolution_points, gems')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'プロフィールの取得に失敗しました' }, { status: 500 });
    }

    const currentEx = (profile as { evolution_points?: number }).evolution_points ?? 0;
    const currentGems = Math.max(0, (profile as { gems?: number }).gems ?? 0);

    if (currentEx < amount) {
      return NextResponse.json({ error: `XPが足りません（所持: ${currentEx}、必要: ${amount}）` }, { status: 400 });
    }

    const gemsToReceive = Math.floor(amount * GEMS_PER_XP);
    if (gemsToReceive <= 0) {
      return NextResponse.json({ error: '交換可能なチップがありません' }, { status: 400 });
    }

    const newEx = currentEx - amount;
    const newGems = currentGems + gemsToReceive;
    const now = new Date().toISOString();

    const { error: updateErr } = await adminSupabase
      .from('profiles')
      .update({
        evolution_points: newEx,
        gems: newGems,
        updated_at: now,
      })
      .eq('user_id', user.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      exchangedEx: amount,
      receivedGems: gemsToReceive,
      newEx,
      newGems,
    });
  } catch (err) {
    console.error('[exchange convert] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
