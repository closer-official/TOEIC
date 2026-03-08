import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, getCurrentWeekIndex } from '@/lib/weekly-events';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** GET: すごろく状態。今週がすごろくでない場合は404（?preview=1 のときはスキップ）。週が変わっていたらリセット＆借金免除 */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const isPreview = req.nextUrl.searchParams.get('preview') === '1' || req.nextUrl.searchParams.get('dev') === '1';
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

    const current = getCurrentEvent();
    if (current.id !== 'sugoroku' && !isPreview) {
      return NextResponse.json({ error: '今週は運命のすごろくではありません' }, { status: 404 });
    }

    const weekIndex = getCurrentWeekIndex();
    const { data: progress } = await supabase
      .from('sugoroku_progress')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const row = progress as {
      event_week_index?: number;
      position?: number;
      dice_count?: number;
      lap_count?: number;
      fragments?: number;
      event_xp?: number;
      trap_guard?: boolean;
      golden_dice_count?: number;
      shop_multiplier?: number;
      last_daily_dice_date?: string | null;
    } | null;

    /** 今日の日付（JST）YYYY-MM-DD */
    const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems, evolution_points')
      .eq('user_id', user.id)
      .maybeSingle();

    const prof = profile as { gems?: number; evolution_points?: number } | null;
    let gems = Math.floor(Number(prof?.gems ?? 0));
    const commonXp = Math.max(0, Math.floor(Number(prof?.evolution_points ?? 0)));

    // 週が変わっていたら: 進行リセット or 新規、借金免除
    if (!row || (row.event_week_index ?? 0) !== weekIndex) {
      if (gems < 0) {
        await supabase
          .from('profiles')
          .update({ gems: 0, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        gems = 0;
      }
      const now = new Date().toISOString();
      const initial = {
        user_id: user.id,
        event_week_index: weekIndex,
        position: 1,
        dice_count: 3, // 初回＝その日の毎日ログインボーナス
        lap_count: 0,
        fragments: 0,
        event_xp: 0,
        trap_guard: false,
        golden_dice_count: 0,
        shop_multiplier: null,
        last_daily_dice_date: todayJst,
        updated_at: now,
      };
      await supabase.from('sugoroku_progress').upsert(initial, { onConflict: 'user_id' });
      return NextResponse.json({
        position: 1,
        diceCount: 3,
        lapCount: 0,
        fragments: 0,
        eventXp: 0,
        commonXp,
        trapGuard: false,
        goldenDiceCount: 0,
        gems,
        shopMultiplier: null,
        canUseShop: true,
      });
    }

    // 毎日ログインで通常サイコロ3個付与（同日は1回だけ）
    let diceCount = row.dice_count ?? 0;
    const lastDaily = row.last_daily_dice_date ?? null;
    if (!lastDaily || lastDaily < todayJst) {
      diceCount = Math.max(0, diceCount) + 3;
      await supabase
        .from('sugoroku_progress')
        .update({
          dice_count: diceCount,
          last_daily_dice_date: todayJst,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('event_week_index', weekIndex);
    }

    return NextResponse.json({
      position: row.position ?? 1,
      diceCount,
      lapCount: row.lap_count ?? 0,
      fragments: row.fragments ?? 0,
      eventXp: row.event_xp ?? 0,
      commonXp,
      trapGuard: Boolean(row.trap_guard),
      goldenDiceCount: row.golden_dice_count ?? 0,
      gems,
      shopMultiplier: row.shop_multiplier ?? null,
      canUseShop: gems >= 0, // 借金中はショップ出禁
    });
  } catch (err) {
    console.error('[sugoroku GET]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
