import { NextResponse } from 'next/server';
import { GACHA_EQUIPMENT } from '@/lib/equipment-items';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';

type SlotKey = 'weapon' | 'head' | 'torso' | 'feet';

/** GET: 自分の装備一覧（grade/level付き）と装着スロット */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { data: rows, error } = await supabase
      .from('user_equipment')
      .select('id, equipment_id, quantity, grade, level, effect_base')
      .eq('user_id', user.id);

    if (error) {
      if (/column.*(grade|level)|does not exist/i.test(error.message)) {
        const legacy = await supabase
          .from('user_equipment')
          .select('equipment_id, quantity')
          .eq('user_id', user.id);
        if (legacy.error) return NextResponse.json({ items: [], equipped: {} }, { status: 200 });
        const byEquip = new Map<string, number>();
        for (const row of legacy.data ?? []) {
          const cur = byEquip.get(row.equipment_id) ?? 0;
          byEquip.set(row.equipment_id, cur + (row.quantity ?? 1));
        }
        const items = [...byEquip.entries()].map(([equipId, quantity]) => {
          const def = GACHA_EQUIPMENT.find((it) => it.id === equipId);
          return {
            id: equipId,
            equipment_id: equipId,
            name: def?.name ?? equipId,
            slot: def?.slot ?? 'weapon',
            slotLabel: def?.slotLabel ?? '装備',
            trait: def?.trait ?? '',
            rarity: def?.rarity ?? 'N',
            quantity,
            grade: 'common' as const,
            level: 0,
            effect_base: 1,
            effect: def?.effect ?? '',
          };
        });
        return NextResponse.json({ items, equipped: {} });
      }
      return NextResponse.json({ items: [], equipped: {} }, { status: 200 });
    }

    const key = (e: string, g: string, l: number, b: number) => `${e}:${g}:${l}:${b}`;
    const agg = new Map<string, { quantity: number; ids: string[] }>();
    for (const row of rows ?? []) {
      const r = row as { id: string; equipment_id: string; quantity: number; grade: string; level: number; effect_base?: number };
      const base = Math.max(0, Number(r.effect_base) || 1);
      const k = key(r.equipment_id, r.grade ?? 'common', r.level ?? 0, base);
      const cur = agg.get(k) ?? { quantity: 0, ids: [] };
      cur.quantity += r.quantity ?? 1;
      cur.ids.push(r.id);
      agg.set(k, cur);
    }

    const items = [...agg.entries()].map(([k, v]) => {
      const parts = k.split(':');
      const equipment_id = parts[0] ?? '';
      const grade = parts[1] ?? 'common';
      const level = Math.max(0, Math.floor(Number(parts[2])) || 0);
      const effect_base = Math.max(0, Number(parts[3]) || 1);
      const def = GACHA_EQUIPMENT.find((it) => it.id === equipment_id);
      return {
        id: v.ids[0],
        equipment_id,
        name: def?.name ?? equipment_id,
        slot: def?.slot ?? 'weapon',
        slotLabel: def?.slotLabel ?? '装備',
        trait: def?.trait ?? '',
        rarity: def?.rarity ?? 'N',
        quantity: v.quantity,
        grade,
        level,
        effect_base,
        effect: def?.effect ?? '',
      };
    });

    // 同じ equipment_id+grade の所持装備のうち最大レベルを取得（昔の装着でプロフィールが Lv.0 のままのときの補正用）
    const bestByEquipGrade = new Map<string, { level: number; effect_base: number }>();
    for (const r of rows ?? []) {
      const row = r as { equipment_id: string; grade?: string; level?: number; effect_base?: number };
      const rLevel = Math.max(0, Math.floor(Number(row.level)) || 0);
      const rBase = Math.max(0, Number(row.effect_base) || 1);
      const key = `${row.equipment_id}:${row.grade ?? 'common'}`;
      const cur = bestByEquipGrade.get(key);
      if (!cur || rLevel > cur.level) bestByEquipGrade.set(key, { level: rLevel, effect_base: rBase });
    }

    const equipCols = 'equipped_weapon_equipment_id,equipped_weapon_grade,equipped_weapon_level,equipped_weapon_effect_base,equipped_head_equipment_id,equipped_head_grade,equipped_head_level,equipped_head_effect_base,equipped_torso_equipment_id,equipped_torso_grade,equipped_torso_level,equipped_torso_effect_base,equipped_feet_equipment_id,equipped_feet_grade,equipped_feet_level,equipped_feet_effect_base';
    const { data: profile } = await supabase
      .from('profiles')
      .select(equipCols)
      .eq('user_id', user.id)
      .maybeSingle();

    const equipped: Record<SlotKey, { equipment_id: string; grade: string; level: number; effect_base: number; name: string; slotLabel: string; effect: string } | null> = {
      weapon: null,
      head: null,
      torso: null,
      feet: null,
    };
    const slots: SlotKey[] = ['weapon', 'head', 'torso', 'feet'];
    const pf = (profile ?? {}) as Record<string, unknown>;
    for (const slot of slots) {
      const eid = pf[`equipped_${slot}_equipment_id`] as string | undefined;
      const g = pf[`equipped_${slot}_grade`] as string | undefined;
      const lRaw = pf[`equipped_${slot}_level`];
      const bRaw = pf[`equipped_${slot}_effect_base`];
      // DB が integer/real を文字列で返す場合があるため、必ず数値にパースする（ルーレットで Lv2〜等のパーセント上昇が反映されない不具合の修正）
      let level = Math.max(0, Math.floor(Number(lRaw)) || 0);
      let effectBase = Math.max(0, Number(bRaw) || 1);
      // 昔の装着でプロフィールに level 0 のまま保存されている場合、所持装備の実データで補正する
      if (eid && level === 0) {
        const key = `${eid}:${g ?? 'common'}`;
        const fromInventory = bestByEquipGrade.get(key);
        if (fromInventory && fromInventory.level > 0) {
          level = fromInventory.level;
          effectBase = fromInventory.effect_base;
        }
      }
      if (eid) {
        const def = GACHA_EQUIPMENT.find((it) => it.id === eid);
        if (def && def.slot === slot) {
          equipped[slot] = {
            equipment_id: eid,
            grade: g ?? 'common',
            level,
            effect_base: effectBase,
            name: def.name,
            slotLabel: def.slotLabel,
            effect: def.effect,
          };
        }
      }
    }

    return NextResponse.json({ items, equipped });
  } catch {
    return NextResponse.json({ items: [], equipped: {} }, { status: 200 });
  }
}
