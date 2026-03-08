import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, getCurrentWeekIndex, getCurrentWeekRange } from '@/lib/weekly-events';
import { getTowerClimate, TOWER_CLIMATES, towerCostG, towerRiskSuccessPct, towerVipCostMultiplier, towerRiskSuccessBonus } from '@/lib/tower-event';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-dynamic';

/** GET: タワー状態・気候・現在階のゴーストXP。?preview=1 で今週でなくても表示可 */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const isPreview = req.nextUrl.searchParams.get('preview') === '1' || req.nextUrl.searchParams.get('dev') === '1';
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const current = getCurrentEvent();
    if (current.id !== 'tower' && !isPreview) {
      return NextResponse.json({ error: '今週は摩天楼のタワーではありません' }, { status: 404 });
    }

    const weekIndex = getCurrentWeekIndex();
    const { start } = getCurrentWeekRange();
    const weekStartMs = start.getTime();
    const { climate, nextChangeMs } = getTowerClimate(weekStartMs);
    const climateInfo = TOWER_CLIMATES[climate];

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
      const now = new Date().toISOString();
      const initial = {
        user_id: user.id,
        event_week_index: weekIndex,
        current_floor: 1,
        floor_xp: 0,
        golden_oil_active: false,
        shock_mat_count: 0,
        master_key_floors_left: 0,
        updated_at: now,
      };
      await supabase.from('tower_progress').upsert(initial, { onConflict: 'user_id' });
      const { data: profile } = await supabase
        .from('profiles')
        .select('gems')
        .eq('user_id', user.id)
        .maybeSingle();
      const gems = Math.max(0, Math.floor(Number((profile as { gems?: number })?.gems ?? 0)));
      return NextResponse.json({
        currentFloor: 1,
        floorXp: 0,
        gems,
        goldenOilActive: false,
        shockMatCount: 0,
        masterKeyFloorsLeft: 0,
        climate: climateInfo,
        climateNextChangeMs: nextChangeMs,
        ghostXpAtFloor: 0,
        costVip: towerCostG(1),
        costVipClimate: Math.floor(towerCostG(1) * towerVipCostMultiplier(climate)),
        costRisk: Math.floor(towerCostG(1) * 0.5),
        costTechnical: Math.floor(towerCostG(1) * 0.2),
        riskSuccessPct: towerRiskSuccessPct(1) + towerRiskSuccessBonus(climate),
      });
    }

    const currentFloor = Math.max(1, row.current_floor ?? 1);
    const { data: ghostRow } = await supabase
      .from('tower_ghosts')
      .select('xp_amount')
      .eq('event_week_index', weekIndex)
      .eq('floor', currentFloor)
      .maybeSingle();

    const ghostXpAtFloor = Math.max(0, (ghostRow as { xp_amount?: number } | null)?.xp_amount ?? 0);

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .maybeSingle();
    const gems = Math.max(0, Math.floor(Number((profile as { gems?: number })?.gems ?? 0)));

    const g = towerCostG(currentFloor);
    return NextResponse.json({
      currentFloor,
      floorXp: row.floor_xp ?? 0,
      gems,
      goldenOilActive: Boolean(row.golden_oil_active),
      shockMatCount: row.shock_mat_count ?? 0,
      masterKeyFloorsLeft: row.master_key_floors_left ?? 0,
      climate: climateInfo,
      climateNextChangeMs: nextChangeMs,
      ghostXpAtFloor,
      costVip: g,
      costVipClimate: Math.floor(g * towerVipCostMultiplier(climate)),
      costRisk: Math.floor(g * 0.5),
      costTechnical: Math.floor(g * 0.2),
      riskSuccessPct: towerRiskSuccessPct(currentFloor) + towerRiskSuccessBonus(climate),
    });
  } catch (err) {
    console.error('[tower GET]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
