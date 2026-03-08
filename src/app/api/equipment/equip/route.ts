import { NextRequest, NextResponse } from 'next/server';
import { GACHA_EQUIPMENT } from '@/lib/equipment-items';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

const SLOTS = ['weapon', 'head', 'torso', 'feet'] as const;
type Slot = (typeof SLOTS)[number];

/** POST: 装備を装着。body: { slot, equipment_id, grade, level, effect_base? } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const slot = SLOTS.includes(body?.slot as Slot) ? (body.slot as Slot) : null;
    const equipment_id = typeof body?.equipment_id === 'string' ? body.equipment_id.trim() : '';
    const grade = typeof body?.grade === 'string' ? body.grade : 'common';
    const level = Math.max(0, Math.floor(Number(body?.level) || 0));
    const effect_base = Math.max(0, Number(body?.effect_base) || 1);

    if (!slot || !equipment_id) {
      return NextResponse.json({ error: 'slot と equipment_id を指定してください' }, { status: 400 });
    }

    const def = GACHA_EQUIPMENT.find((it) => it.id === equipment_id);
    if (!def || def.slot !== slot) {
      return NextResponse.json({ error: 'その装備はこのスロットに装着できません' }, { status: 400 });
    }

    const { data: rows } = await supabase
      .from('user_equipment')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('equipment_id', equipment_id)
      .eq('grade', grade)
      .eq('level', level)
      .eq('effect_base', effect_base);

    const total = (rows ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0);
    if (total < 1) {
      return NextResponse.json({ error: 'その装備を所持していません' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      updated_at: now,
      [`equipped_${slot}_equipment_id`]: equipment_id,
      [`equipped_${slot}_grade`]: grade,
      [`equipped_${slot}_level`]: level,
      [`equipped_${slot}_effect_base`]: effect_base,
    };

    const { error: updateErr } = await supabase
      .from('profiles')
      .update(update)
      .eq('user_id', user.id);

    if (updateErr) {
      if (/column.*equipped|does not exist/i.test(updateErr.message)) {
        return NextResponse.json({ error: '装備スロット機能は準備中です' }, { status: 503 });
      }
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[equipment equip]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
