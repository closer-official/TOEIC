import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, getCurrentWeekIndex } from '@/lib/weekly-events';
import { TOWER_ITEMS, type TowerItemId } from '@/lib/tower-event';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** POST: タワー専用アイテムを購入。body: { itemId: 'golden_oil' | 'shock_mat' | 'master_key' } */
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

    if (getCurrentEvent().id !== 'tower') {
      return NextResponse.json({ error: '今週は摩天楼のタワーではありません' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const itemId = (['golden_oil', 'shock_mat', 'master_key'] as const).includes(body?.itemId)
      ? (body.itemId as TowerItemId)
      : null;
    if (!itemId) {
      return NextResponse.json({ error: 'itemId を指定してください（golden_oil / shock_mat / master_key）' }, { status: 400 });
    }

    const item = TOWER_ITEMS[itemId];
    const price = item.price;

    const weekIndex = getCurrentWeekIndex();
    const { data: progress } = await supabase
      .from('tower_progress')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const row = progress as {
      event_week_index?: number;
      golden_oil_active?: boolean;
      shock_mat_count?: number;
      master_key_floors_left?: number;
    } | null;

    if (!row || (row.event_week_index ?? 0) !== weekIndex) {
      return NextResponse.json({ error: '進行状態を取得してください' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .maybeSingle();
    let gems = Math.max(0, Math.floor(Number((profile as { gems?: number })?.gems ?? 0)));

    if (gems < price) {
      return NextResponse.json({ error: `チップが足りません（${item.name}: ${price}チップ）` }, { status: 402 });
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      updated_at: now,
    };

    if (itemId === 'golden_oil') {
      updates.golden_oil_active = true;
    } else if (itemId === 'shock_mat') {
      updates.shock_mat_count = Math.min(99, (row.shock_mat_count ?? 0) + 1);
    } else {
      updates.master_key_floors_left = Math.min(5, (row.master_key_floors_left ?? 0) + 5);
    }

    await supabase.from('profiles').update({ gems: gems - price, updated_at: now }).eq('user_id', user.id);
    await supabase.from('tower_progress').update(updates).eq('user_id', user.id);

    return NextResponse.json({
      ok: true,
      itemId,
      itemName: item.name,
      gems: gems - price,
      goldenOilActive: itemId === 'golden_oil' ? true : row.golden_oil_active,
      shockMatCount: itemId === 'shock_mat' ? (row.shock_mat_count ?? 0) + 1 : row.shock_mat_count ?? 0,
      masterKeyFloorsLeft: itemId === 'master_key' ? Math.min(5, (row.master_key_floors_left ?? 0) + 5) : row.master_key_floors_left ?? 0,
    });
  } catch (err) {
    console.error('[tower shop]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
