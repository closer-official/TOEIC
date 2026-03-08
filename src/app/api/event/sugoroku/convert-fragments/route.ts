import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, getCurrentWeekIndex } from '@/lib/weekly-events';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const FRAGMENTS_PER_MATERIAL = 10;
const ETERNAL_MATERIAL_ITEM_ID = 'eternal_material';

/** POST: エターナルのかけら10個をエターナル素材1個に変換する */
export async function POST(req: NextRequest) {
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
      .select('fragments, event_week_index')
      .eq('user_id', user.id)
      .maybeSingle();

    const row = progress as { fragments?: number; event_week_index?: number } | null;
    if (!row || (row.event_week_index ?? 0) !== weekIndex) {
      return NextResponse.json({ error: 'すごろくの進行状態を取得してから変換してください' }, { status: 400 });
    }

    const fragments = row.fragments ?? 0;
    if (fragments < FRAGMENTS_PER_MATERIAL) {
      return NextResponse.json({
        error: `エターナルのかけらが足りません（${FRAGMENTS_PER_MATERIAL}個必要、所持${fragments}個）`,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    await supabase
      .from('sugoroku_progress')
      .update({
        fragments: fragments - FRAGMENTS_PER_MATERIAL,
        updated_at: now,
      })
      .eq('user_id', user.id);

    await supabase.from('user_inventory').insert({
      user_id: user.id,
      item_id: ETERNAL_MATERIAL_ITEM_ID,
      quantity: 1,
    });

    return NextResponse.json({
      ok: true,
      fragmentsLeft: fragments - FRAGMENTS_PER_MATERIAL,
      eternalMaterialAdded: 1,
    });
  } catch (err) {
    console.error('[sugoroku convert-fragments]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
