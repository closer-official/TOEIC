import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const SLOTS = ['weapon', 'head', 'torso', 'feet'] as const;

/** POST: 装備を捨てる。body: { equipment_id, grade, level, effect_base, quantity? }。quantity 省略時は1個。装着中なら先にスロットを外してから捨てる。 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
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

    const body = await req.json().catch(() => ({}));
    const equipment_id = typeof body?.equipment_id === 'string' ? body.equipment_id.trim() : '';
    const grade = typeof body?.grade === 'string' ? body.grade : 'common';
    const level = Math.max(0, Math.floor(Number(body?.level)) || 0);
    const effect_base = Math.max(0, Number(body?.effect_base) || 1);
    const quantity = Math.max(1, Math.floor(Number(body?.quantity)) || 1);

    if (!equipment_id) {
      return NextResponse.json({ error: 'equipment_id を指定してください' }, { status: 400 });
    }

    const equipCols = SLOTS.flatMap((s) => [
      `equipped_${s}_equipment_id`,
      `equipped_${s}_grade`,
      `equipped_${s}_level`,
      `equipped_${s}_effect_base`,
    ]);
    const { data: profile } = await supabase
      .from('profiles')
      .select(equipCols.join(','))
      .eq('user_id', user.id)
      .maybeSingle();

    const pf = (profile ?? {}) as Record<string, unknown>;
    for (const slot of SLOTS) {
      const eid = pf[`equipped_${slot}_equipment_id`];
      const g = pf[`equipped_${slot}_grade`];
      const l = pf[`equipped_${slot}_level`];
      const b = pf[`equipped_${slot}_effect_base`];
      if (
        eid === equipment_id &&
        (g ?? 'common') === grade &&
        Math.floor(Number(l) || 0) === level &&
        Number(b || 1) === effect_base
      ) {
        const clearUpdate: Record<string, null | number> = {
          [`equipped_${slot}_equipment_id`]: null,
          [`equipped_${slot}_grade`]: null,
          [`equipped_${slot}_level`]: null,
          [`equipped_${slot}_effect_base`]: 1,
        };
        const { error: clearErr } = await supabase
          .from('profiles')
          .update(clearUpdate)
          .eq('user_id', user.id);
        if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 });
        break;
      }
    }

    const { data: rows } = await supabase
      .from('user_equipment')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('equipment_id', equipment_id)
      .eq('grade', grade)
      .eq('level', level)
      .eq('effect_base', effect_base)
      .order('id', { ascending: true });

    const list = (rows ?? []) as { id: string; quantity: number }[];
    const total = list.reduce((s, r) => s + (r.quantity ?? 1), 0);
    if (total < 1) {
      return NextResponse.json({ error: 'その装備を所持していません' }, { status: 400 });
    }
    const toRemove = Math.min(quantity, total);

    let remaining = toRemove;
    for (const row of list) {
      if (remaining <= 0) break;
      const q = row.quantity ?? 1;
      if (q <= remaining) {
        const { error: delErr } = await supabase.from('user_equipment').delete().eq('id', row.id);
        if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
        remaining -= q;
      } else {
        const { error: updErr } = await supabase
          .from('user_equipment')
          .update({ quantity: q - remaining })
          .eq('id', row.id);
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
        remaining = 0;
      }
    }

    return NextResponse.json({
      ok: true,
      message: toRemove === 1 ? '装備を1個捨てました' : `装備を${toRemove}個捨てました`,
    });
  } catch (err) {
    console.error('[equipment discard]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
