import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { nextEquipmentGrade, equipmentEffectMultiplier, timeDecayRateMultiplier, GACHA_EQUIPMENT } from '@/lib/equipment-items';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** POST: 同じ装備・同じレアリティ5個で次のグレードに進化（レベル混在可）。進化後は消費した5個のうち最も高いレベル品の効果倍率を引き継ぎ、次のグレードの Lv.0 になる。
 * body: { equipment_id, grade, consume?: [{ level, effect_base, quantity }] } — consume を渡すと進化に使う5個を指定可能。合計5になること。 */
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
    const consumeInput = Array.isArray(body?.consume) ? body.consume as { level?: number; effect_base?: number; quantity?: number }[] : undefined;

    if (!equipment_id) {
      return NextResponse.json({ error: 'equipment_id を指定してください' }, { status: 400 });
    }

    const next = nextEquipmentGrade(grade as 'common' | 'normal' | 'rare' | 'epic' | 'legendary' | 'eternal');
    if (!next) {
      return NextResponse.json({ error: 'このグレードはこれ以上進化できません' }, { status: 400 });
    }

    // 同じ装備・同じレアリティの全行
    const { data: rows } = await supabase
      .from('user_equipment')
      .select('id, quantity, grade, level, effect_base')
      .eq('user_id', user.id)
      .eq('equipment_id', equipment_id)
      .eq('grade', grade)
      .order('level', { ascending: false })
      .order('effect_base', { ascending: false });

    const total = (rows ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0);
    if (total < 5) {
      return NextResponse.json({
        error: `同じ装備・同じレアリティが5個必要です（${equipment_id} ${grade}: 所持${total}個）`,
      }, { status: 400 });
    }

    const eqDef = GACHA_EQUIPMENT.find((e) => e.id === equipment_id);
    const isTimeDecayRate = eqDef?.effectKey === 'time_decay_rate';
    const gradeCast = grade as 'common' | 'normal' | 'rare' | 'epic' | 'legendary' | 'eternal';
    let bestMultiplier = isTimeDecayRate ? Infinity : 1;
    const updateBest = (mult: number) => {
      if (isTimeDecayRate) { if (mult < bestMultiplier) bestMultiplier = mult; }
      else { if (mult > bestMultiplier) bestMultiplier = mult; }
    };
    const calcMult = (g: typeof gradeCast, l: number, b: number) =>
      isTimeDecayRate ? timeDecayRateMultiplier(g, l, b) : equipmentEffectMultiplier(g, l, b);

    type ConsumePlan = { level: number; effect_base: number; quantity: number };
    let toConsume: ConsumePlan[];

    if (consumeInput && consumeInput.length > 0) {
      const totalConsume = consumeInput.reduce((s, c) => s + Math.max(0, Math.floor(Number(c.quantity) || 0)), 0);
      if (totalConsume !== 5) {
        return NextResponse.json({ error: '進化に使う個数の合計は5にしてください' }, { status: 400 });
      }
      toConsume = consumeInput
        .map((c) => ({
          level: Math.max(0, Math.floor(Number(c.level)) || 0),
          effect_base: Math.max(0, Number(c.effect_base) || 1),
          quantity: Math.max(0, Math.floor(Number(c.quantity) || 0)),
        }))
        .filter((c) => c.quantity > 0);
      if (toConsume.reduce((s, c) => s + c.quantity, 0) !== 5) {
        return NextResponse.json({ error: '進化に使う個数の合計は5にしてください' }, { status: 400 });
      }
      // 所持数チェック: 各 (level, effect_base) について、そのスタックの所持数 >= 指定 quantity
      const byKey = new Map<string, number>();
      for (const r of rows ?? []) {
        const l = Math.max(0, Math.floor(Number(r.level)) || 0);
        const b = Math.max(0, Number(r.effect_base) || 1);
        const k = `${l}:${b}`;
        byKey.set(k, (byKey.get(k) ?? 0) + (r.quantity ?? 0));
      }
      for (const c of toConsume) {
        const have = byKey.get(`${c.level}:${c.effect_base}`) ?? 0;
        if (have < c.quantity) {
          return NextResponse.json({
            error: `Lv.${c.level} effect_base=${c.effect_base} の所持が足りません（指定${c.quantity}個、所持${have}個）`,
          }, { status: 400 });
        }
      }
      for (const c of toConsume) {
        updateBest(calcMult(gradeCast, c.level, c.effect_base));
      }
    } else {
      // consume 未指定: 従来どおりレベル・effect_base の高い順に5個消費
      toConsume = [];
      for (const row of rows ?? []) {
        const g = (row as { grade?: string }).grade ?? grade;
        const l = Math.max(0, Math.floor(Number((row as { level?: number }).level) ?? 0));
        const base = Math.max(0, Number((row as { effect_base?: number }).effect_base) || 1);
        updateBest(calcMult(g as typeof gradeCast, l, base));
      }
    }

    const newEffectBase = isTimeDecayRate ? (bestMultiplier === Infinity ? 1 : bestMultiplier) : bestMultiplier;

    if (toConsume.length > 0) {
      // 指定どおり消費: 各 (level, effect_base) について、そのスタックの行から quantity 分を減らす
      for (const c of toConsume) {
        let remaining = c.quantity;
        const { data: stackRows } = await supabase
          .from('user_equipment')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('equipment_id', equipment_id)
          .eq('grade', grade)
          .eq('level', c.level)
          .eq('effect_base', c.effect_base)
          .order('id', { ascending: true });
        for (const row of stackRows ?? []) {
          if (remaining <= 0) break;
          const q = row.quantity ?? 0;
          if (q <= remaining) {
            await supabase.from('user_equipment').delete().eq('id', row.id);
            remaining -= q;
          } else {
            await supabase.from('user_equipment').update({ quantity: q - remaining }).eq('id', row.id);
            remaining = 0;
          }
        }
      }
    } else {
      let remaining = 5;
      for (const row of rows ?? []) {
        if (remaining <= 0) break;
        const q = row.quantity ?? 0;
        if (q <= remaining) {
          await supabase.from('user_equipment').delete().eq('id', row.id);
          remaining -= q;
        } else {
          await supabase.from('user_equipment').update({ quantity: q - remaining }).eq('id', row.id);
          remaining = 0;
        }
      }
    }

    const { data: existingNext } = await supabase
      .from('user_equipment')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('equipment_id', equipment_id)
      .eq('grade', next)
      .eq('level', 0)
      .eq('effect_base', newEffectBase)
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
        grade: next,
        level: 0,
        effect_base: newEffectBase,
      });
    }

    return NextResponse.json({ ok: true, newGrade: next });
  } catch (err) {
    console.error('[equipment evolve]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
