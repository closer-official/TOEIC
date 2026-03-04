import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { GACHA_EQUIPMENT } from '@/lib/equipment-items';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** POST: 装備を1個出品。body: { itemId (equipment_id), priceGems, equipment_grade, equipment_level, effect_base } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
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

    const body = await req.json().catch(() => ({}));
    const itemId = String(body?.itemId ?? '').trim();
    const priceGems = Math.max(1, Math.floor(Number(body?.priceGems ?? 1)));
    const equipmentGrade = String(body?.equipment_grade ?? '').trim();
    const equipmentLevel = Math.max(0, Math.floor(Number(body?.equipment_level ?? 0)));
    const effectBase = Math.max(0, Number(body?.effect_base ?? 1));

    if (!itemId) {
      return NextResponse.json({ error: '装備を指定してください' }, { status: 400 });
    }
    const validGrades = ['common', 'normal', 'rare', 'epic', 'legendary', 'eternal'];
    if (!validGrades.includes(equipmentGrade)) {
      return NextResponse.json({ error: '無効なグレードです' }, { status: 400 });
    }

    const def = GACHA_EQUIPMENT.find((it) => it.id === itemId);
    if (!def) {
      return NextResponse.json({ error: '無効な装備です' }, { status: 400 });
    }

    const adminSupabase = supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey)
      : supabase;

    const { data: eqRows } = await adminSupabase
      .from('user_equipment')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('equipment_id', itemId)
      .eq('grade', equipmentGrade)
      .eq('level', equipmentLevel)
      .eq('effect_base', effectBase);

    const row = (eqRows ?? [])[0];
    if (!row || (row.quantity ?? 0) < 1) {
      return NextResponse.json({ error: 'その装備を所持していません' }, { status: 400 });
    }

    const q = row.quantity ?? 0;
    if (q > 1) {
      await adminSupabase
        .from('user_equipment')
        .update({ quantity: q - 1 })
        .eq('id', row.id);
    } else {
      await adminSupabase.from('user_equipment').delete().eq('id', row.id);
    }

    const itemRarity = def.rarity === 'SR' ? 'SR' : def.rarity === 'R' ? 'R' : 'N';

    const { data: listing, error: insertErr } = await adminSupabase
      .from('marketplace_listings')
      .insert({
        seller_id: user.id,
        item_type: 'equipment',
        item_id: itemId,
        quantity: 1,
        price_gems: priceGems,
        item_name: def.name,
        item_rarity: itemRarity,
        status: 'active',
        equipment_grade: equipmentGrade,
        equipment_level: equipmentLevel,
        effect_base: effectBase,
      })
      .select('id, item_name, item_rarity, quantity, price_gems, created_at')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    console.error('[exchange listings] POST error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
