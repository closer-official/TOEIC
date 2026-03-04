import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-static';

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [{ id: '0' }];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** DELETE: 出品を取り消す（自分の出品のみ） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // ignore
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

    const adminSupabase = supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey)
      : supabase;

    const { data: listing, error: fetchErr } = await adminSupabase
      .from('marketplace_listings')
      .select('seller_id, item_type, item_id, quantity, status')
      .eq('id', id)
      .single();

    if (fetchErr || !listing) {
      return NextResponse.json({ error: '出品が見つかりません' }, { status: 404 });
    }

    if ((listing as { seller_id: string }).seller_id !== user.id) {
      return NextResponse.json({ error: '自分の出品のみ取り消せます' }, { status: 403 });
    }

    if ((listing as { status: string }).status !== 'active') {
      return NextResponse.json({ error: 'この出品は既に終了しています' }, { status: 400 });
    }

    const itemType = (listing as { item_type: string }).item_type;
    const itemId = (listing as { item_id: string }).item_id;
    const qty = (listing as { quantity: number }).quantity;

    // 在庫に戻す
    if (itemType === 'item') {
      await adminSupabase.from('user_inventory').insert({
        user_id: user.id,
        item_id: itemId,
        quantity: qty,
      });
    } else {
      await adminSupabase.from('user_equipment').insert({
        user_id: user.id,
        equipment_id: itemId,
        quantity: qty,
      });
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
