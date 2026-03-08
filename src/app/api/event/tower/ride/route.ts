import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, getCurrentWeekIndex, getCurrentWeekRange } from '@/lib/weekly-events';
import {
  getTowerClimate,
  towerCostG,
  towerRiskSuccessPct,
  towerVipCostMultiplier,
  towerRiskSuccessBonus,
  towerTechnicalSuccessFloors,
  type TowerElevatorId,
} from '@/lib/tower-event';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** POST: エレベーターを選択して乗る。body: { elevator, useGoldenOil?, useShockMat?, useMasterKey? } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
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
    const isPreview = body?.preview === true;
    if (getCurrentEvent().id !== 'tower' && !isPreview) {
      return NextResponse.json({ error: '今週は摩天楼のタワーではありません' }, { status: 404 });
    }

    const weekIndex = getCurrentWeekIndex();
    const { start } = getCurrentWeekRange();
    const { climate } = getTowerClimate(start.getTime());

    const elevator = (['vip', 'risk', 'technical'] as const).includes(body?.elevator)
      ? (body.elevator as TowerElevatorId)
      : null;
    if (!elevator) {
      return NextResponse.json({ error: 'エレベーターを指定してください（vip / risk / technical）' }, { status: 400 });
    }

    const useGoldenOil = Boolean(body?.useGoldenOil);
    const useShockMat = Boolean(body?.useShockMat);
    const useMasterKey = Boolean(body?.useMasterKey);

    const { data: progress } = await supabase
      .from('tower_progress')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const row = progress as {
      event_week_index?: number;
      current_floor?: number;
      floor_xp?: number;
      golden_oil_active?: boolean;
      shock_mat_count?: number;
      master_key_floors_left?: number;
    } | null;

    if (!row || (row.event_week_index ?? 0) !== weekIndex) {
      return NextResponse.json({ error: '進行状態を取得してください' }, { status: 400 });
    }

    const currentFloor = Math.max(1, row.current_floor ?? 1);
    let goldenOilActive = Boolean(row.golden_oil_active);
    let shockMatCount = Math.max(0, row.shock_mat_count ?? 0);
    let masterKeyFloorsLeft = Math.max(0, Math.min(5, row.master_key_floors_left ?? 0));

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .maybeSingle();
    let gems = Math.max(0, Math.floor(Number((profile as { gems?: number })?.gems ?? 0)));

    const g = towerCostG(currentFloor);
    let cost = 0;
    if (elevator === 'vip') {
      cost = Math.floor(g * towerVipCostMultiplier(climate));
      if (useMasterKey && masterKeyFloorsLeft > 0) {
        cost = Math.floor(cost * 0.7);
        masterKeyFloorsLeft -= 1;
      }
    } else if (elevator === 'risk') {
      cost = Math.floor(g * 0.5);
    } else {
      cost = Math.floor(g * 0.2);
    }

    if (gems < cost) {
      return NextResponse.json({ error: `チップが足りません（必要: ${cost}）` }, { status: 402 });
    }

    let newFloor = currentFloor;
    let newFloorXp = row.floor_xp ?? 0;
    let success = true;
    let message = '';
    let ghostCollected = 0;
    let fallFloors = 0;

    if (elevator === 'vip') {
      newFloor = currentFloor + 1;
      message = 'VIP専用機で1階上昇しました。';
    } else if (elevator === 'risk') {
      let pct = towerRiskSuccessPct(currentFloor) + towerRiskSuccessBonus(climate);
      if (useGoldenOil && goldenOilActive) {
        pct += 20;
        goldenOilActive = false;
      }
      pct = Math.min(95, Math.max(5, pct));
      const roll = Math.random() * 100;
      success = roll < pct;
      if (success) {
        newFloor = currentFloor + 1;
        message = `ギャンブラー・リフト成功！${newFloor}階へ。`;
      } else {
        fallFloors = randomInt(1, 3);
        if (useShockMat && shockMatCount > 0) {
          fallFloors = Math.max(0, fallFloors - 1);
          shockMatCount -= 1;
        }
        newFloor = Math.max(1, currentFloor - fallFloors);
        const droppedXp = row.floor_xp ?? 0;
        if (droppedXp > 0) {
          const { data: existing } = await supabase
            .from('tower_ghosts')
            .select('xp_amount')
            .eq('event_week_index', weekIndex)
            .eq('floor', currentFloor)
            .maybeSingle();
          const prev = Math.max(0, (existing as { xp_amount?: number } | null)?.xp_amount ?? 0);
          await supabase
            .from('tower_ghosts')
            .upsert(
              {
                event_week_index: weekIndex,
                floor: currentFloor,
                xp_amount: prev + droppedXp,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'event_week_index,floor' }
            );
        }
        message = `ギャンブラー・リフト失敗…${fallFloors}階落下。${droppedXp > 0 ? '遺失XPを落としました。' : ''}`;
        newFloorXp = 0;
      }
    } else {
      const pct = 30;
      const roll = Math.random() * 100;
      success = roll < pct;
      const upFloors = towerTechnicalSuccessFloors(climate);
      if (success) {
        newFloor = currentFloor + upFloors;
        message = `非常用ハッチ成功！${upFloors}階上昇。`;
      } else {
        message = '非常用ハッチ失敗。現在階のXP進捗をリセットしました。';
        newFloorXp = 0;
      }
    }

    if (success && newFloor > currentFloor) {
      const { data: ghostRow } = await supabase
        .from('tower_ghosts')
        .select('xp_amount')
        .eq('event_week_index', weekIndex)
        .eq('floor', newFloor)
        .maybeSingle();
      const xpThere = (ghostRow as { xp_amount?: number } | null)?.xp_amount ?? 0;
      if (xpThere > 0) {
        ghostCollected = xpThere;
        newFloorXp += xpThere;
        await supabase
          .from('tower_ghosts')
          .update({ xp_amount: 0, updated_at: new Date().toISOString() })
          .eq('event_week_index', weekIndex)
          .eq('floor', newFloor);
      }
    }

    gems -= cost;
    const now = new Date().toISOString();
    await supabase
      .from('profiles')
      .update({ gems, updated_at: now })
      .eq('user_id', user.id);

    await supabase
      .from('tower_progress')
      .update({
        current_floor: newFloor,
        floor_xp: newFloorXp,
        golden_oil_active: goldenOilActive,
        shock_mat_count: shockMatCount,
        master_key_floors_left: masterKeyFloorsLeft,
        updated_at: now,
      })
      .eq('user_id', user.id);

    return NextResponse.json({
      success,
      message,
      currentFloor: newFloor,
      floorXp: newFloorXp,
      gems,
      goldenOilActive,
      shockMatCount,
      masterKeyFloorsLeft,
      ghostCollected,
      fallFloors: elevator === 'risk' && !success ? fallFloors : 0,
    });
  } catch (err) {
    console.error('[tower ride]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
