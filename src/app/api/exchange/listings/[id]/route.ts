import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-dynamic';

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [{ id: '0' }];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** DELETE: 出品を取り消す（自分の出品のみ） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const { id } = await params;
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const adminSupabase = supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey)
      : supabase;

    const { data: listing, error: fetchErr } = await adminSupabase
      .from('marketplace_listings')
      .select('seller_id, item_type, item_id, quantity, status, equipment_grade, equipment_level, effect_base')
      .eq('id', id)
      .single();

    if (fetchErr || !listing) {
      return NextResponse.json({ error: '出品が見つかりません' }, { status: 404 });
    }

    const L = listing as {
      seller_id: string;
      item_type: string;
      item_id: string;
      quantity: number;
      status: string;
      equipment_grade?: string | null;
      equipment_level?: number | null;
      effect_base?: number | null;
    };

    if (L.seller_id !== user.id) {
      return NextResponse.json({ error: '自分の出品のみ取り消せます' }, { status: 403 });
    }

    if (L.status !== 'active') {
      return NextResponse.json({ error: 'この出品は既に終了しています' }, { status: 400 });
    }

    // 在庫に戻す
    if (L.item_type === 'item') {
      const { error: insertErr } = await adminSupabase.from('user_inventory').insert({
        user_id: user.id,
        item_id: L.item_id,
        quantity: L.quantity,
      });
      if (insertErr) {
        console.error('[exchange listings delete] user_inventory insert:', insertErr);
        return NextResponse.json({ error: '在庫の復元に失敗しました' }, { status: 500 });
      }
    } else {
      const grade = (L.equipment_grade && ['common', 'normal', 'rare', 'epic', 'legendary', 'eternal'].includes(L.equipment_grade))
        ? L.equipment_grade
        : 'common';
      const level = typeof L.equipment_level === 'number' && L.equipment_level >= 0 ? L.equipment_level : 0;
      const effectBase = typeof L.effect_base === 'number' && L.effect_base >= 0 ? L.effect_base : 1;
      const { error: insertErr } = await adminSupabase.from('user_equipment').insert({
        user_id: user.id,
        equipment_id: L.item_id,
        quantity: L.quantity,
        grade,
        level,
        effect_base: effectBase,
      });
      if (insertErr) {
        console.error('[exchange listings delete] user_equipment insert:', insertErr);
        return NextResponse.json({ error: '装備の復元に失敗しました' }, { status: 500 });
      }
    }

    await adminSupabase
      .from('marketplace_listings')
      .update({ status: 'cancelled' })
      .eq('id', id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[exchange listings delete] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
