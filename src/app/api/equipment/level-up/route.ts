import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { costForEquipmentLevel } from '@/lib/equipment-items';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** POST: 装備をレベルアップ（XP消費）。body: { equipment_id, grade, level } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
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
    const equipment_id = typeof body?.equipment_id === 'string' ? body.equipment_id.trim() : '';
    const grade = typeof body?.grade === 'string' ? body.grade : 'common';
    const level = Math.max(0, Math.floor(Number(body?.level) || 0));

    if (!equipment_id) {
      return NextResponse.json({ error: 'equipment_id を指定してください' }, { status: 400 });
    }

    const xpCost = costForEquipmentLevel(level);
    const { data: profile } = await supabase
      .from('profiles')
      .select('evolution_points')
      .eq('user_id', user.id)
      .maybeSingle();

    const points = Math.max(0, (profile as { evolution_points?: number } | null)?.evolution_points ?? 0);
    if (points < xpCost) {
      return NextResponse.json({
        error: `XPが足りません（必要: ${xpCost}、所持: ${points}）`,
      }, { status: 400 });
    }

    const { data: rows } = await supabase
      .from('user_equipment')
      .select('id, quantity, effect_base')
      .eq('user_id', user.id)
      .eq('equipment_id', equipment_id)
      .eq('grade', grade)
      .eq('level', level)
      .order('quantity', { ascending: false });

    const total = (rows ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0);
    if (total < 1) {
      return NextResponse.json({ error: 'その装備を所持していません' }, { status: 400 });
    }

    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: '装備が見つかりません' }, { status: 400 });
    }

    const q = row.quantity ?? 0;
    const now = new Date().toISOString();

    const effectBase = Math.max(0, Number((row as { effect_base?: number }).effect_base) || 1);

    if (q === 1) {
      await supabase.from('user_equipment').update({ level: level + 1 }).eq('id', row.id);
    } else {
      await supabase.from('user_equipment').update({ quantity: q - 1 }).eq('id', row.id);
      const { data: existingNext } = await supabase
        .from('user_equipment')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('equipment_id', equipment_id)
        .eq('grade', grade)
        .eq('level', level + 1)
        .eq('effect_base', effectBase)
        .maybeSingle();

      if (existingNext) {
        await supabase
          .from('user_equipment')
          .update({ quantity: (existingNext.quantity ?? 0) + 1 })
          .eq('id', existingNext.id);
      } else {
        await supabase.from('user_equipment').insert({
          user_id: user.id,
          equipment_id,
          quantity: 1,
          grade,
          level: level + 1,
          effect_base: effectBase,
        });
      }
    }

    const profileUpdate: Record<string, unknown> = {
      evolution_points: points - xpCost,
      updated_at: now,
    };

    // 装着中の同じスタックをレベルアップした場合、装着スロットのレベルも更新する
    const equipCols =
      'equipped_weapon_equipment_id,equipped_weapon_grade,equipped_weapon_level,equipped_head_equipment_id,equipped_head_grade,equipped_head_level,equipped_torso_equipment_id,equipped_torso_grade,equipped_torso_level,equipped_feet_equipment_id,equipped_feet_grade,equipped_feet_level';
    const { data: profileRow } = await supabase
      .from('profiles')
      .select(equipCols)
      .eq('user_id', user.id)
      .maybeSingle();

    const pf = (profileRow ?? {}) as Record<string, unknown>;
    const slots = ['weapon', 'head', 'torso', 'feet'] as const;
    for (const slot of slots) {
      const eid = pf[`equipped_${slot}_equipment_id`];
      const g = pf[`equipped_${slot}_grade`];
      const l = pf[`equipped_${slot}_level`];
      if (eid === equipment_id && g === grade && l === level) {
        (profileUpdate as Record<string, number>)[`equipped_${slot}_level`] = level + 1;
      }
    }

    await supabase.from('profiles').update(profileUpdate).eq('user_id', user.id);

    return NextResponse.json({ ok: true, newLevel: level + 1, xpSpent: xpCost });
  } catch (err) {
    console.error('[equipment level-up]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
