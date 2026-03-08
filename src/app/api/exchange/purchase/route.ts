import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const PLATFORM_FEE_RATE = 0.1; // 1割焼却

/** POST: 出品を購入。body: { listingId: string } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const listingId = String(body?.listingId ?? '').trim();
    if (!listingId) {
      return NextResponse.json({ error: '出品IDを指定してください' }, { status: 400 });
    }

    const adminSupabase = supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey)
      : supabase;

    const { data: listing, error: fetchErr } = await adminSupabase
      .from('marketplace_listings')
      .select('id, seller_id, item_type, item_id, quantity, price_gems, status, equipment_grade, equipment_level, effect_base')
      .eq('id', listingId)
      .single();

    if (fetchErr || !listing) {
      return NextResponse.json({ error: '出品が見つかりません' }, { status: 404 });
    }

    const L = listing as { seller_id: string; item_type: string; item_id: string; quantity: number; price_gems: number; status: string; equipment_grade?: string | null; equipment_level?: number | null; effect_base?: number | null };
    if (L.seller_id === user.id) {
      return NextResponse.json({ error: '自分の出品は購入できません' }, { status: 400 });
    }
    if (L.status !== 'active') {
      return NextResponse.json({ error: 'この出品は既に売り切れです' }, { status: 400 });
    }

    const price = L.price_gems;
    const sellerGems = Math.floor(price * (1 - PLATFORM_FEE_RATE));
    // 1割は焼却（誰にも渡さない）

    const { data: buyerProfile } = await adminSupabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .maybeSingle();

    const buyerGems = Math.max(0, (buyerProfile as { gems?: number })?.gems ?? 0);
    if (buyerGems < price) {
      return NextResponse.json({ error: `チップが足りません（必要: ${price}、所持: ${buyerGems}）` }, { status: 402 });
    }

    const { data: sellerProfile } = await adminSupabase
      .from('profiles')
      .select('gems')
      .eq('user_id', L.seller_id)
      .maybeSingle();

    const sellerCurrentGems = Math.max(0, (sellerProfile as { gems?: number })?.gems ?? 0);
    const now = new Date().toISOString();

    // 購入者: チップ減少
    await adminSupabase
      .from('profiles')
      .update({ gems: buyerGems - price, updated_at: now })
      .eq('user_id', user.id);

    // 販売者: チップ増加（9割）
    await adminSupabase
      .from('profiles')
      .update({ gems: sellerCurrentGems + sellerGems, updated_at: now })
      .eq('user_id', L.seller_id);

    // 購入者に装備を付与（出品は装備のみ。グレード・レベル・effect_base をそのまま付与）
    const grade = (L.equipment_grade && ['common', 'normal', 'rare', 'epic', 'legendary', 'eternal'].includes(L.equipment_grade)) ? L.equipment_grade : 'common';
    const level = typeof L.equipment_level === 'number' && L.equipment_level >= 0 ? L.equipment_level : 0;
    const effectBase = typeof L.effect_base === 'number' && L.effect_base >= 0 ? L.effect_base : 1;
    await adminSupabase.from('user_equipment').insert({
      user_id: user.id,
      equipment_id: L.item_id,
      quantity: L.quantity,
      grade,
      level,
      effect_base: effectBase,
    });

    // 出品を sold に更新
    await adminSupabase
      .from('marketplace_listings')
      .update({ status: 'sold' })
      .eq('id', listingId);

    return NextResponse.json({
      ok: true,
      receivedQuantity: L.quantity,
      paidGems: price,
      newGems: buyerGems - price,
    });
  } catch (err) {
    console.error('[exchange purchase] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
