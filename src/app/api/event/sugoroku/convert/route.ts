import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, getCurrentWeekIndex } from '@/lib/weekly-events';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** 10 Event XP → 1 ジェム */
const XP_PER_GEM = 10;

/** POST: イベントXPをジェムに換金。body: { amount } (ジェム数。amount*10 のXPを消費) */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
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

    const isPreview = req.headers.get('x-preview') === '1' || req.headers.get('x-dev') === '1';
    if (getCurrentEvent().id !== 'sugoroku' && !isPreview) {
      return NextResponse.json({ error: '今週は運命のすごろくではありません' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const amount = Math.floor(Number(body?.amount ?? 0));
    if (amount < 1) {
      return NextResponse.json({ error: '1以上のチップ数を指定してください' }, { status: 400 });
    }

    const xpCost = amount * XP_PER_GEM;
    const weekIndex = getCurrentWeekIndex();

    const { data: progress } = await supabase
      .from('sugoroku_progress')
      .select('event_xp')
      .eq('user_id', user.id)
      .maybeSingle();
    const eventXp = (progress as { event_xp?: number })?.event_xp ?? 0;
    if (eventXp < xpCost) {
      return NextResponse.json({
        error: `イベントXPが足りません（必要: ${xpCost}、所持: ${eventXp}）`,
      }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .maybeSingle();
    const currentGems = Math.floor(Number((profile as { gems?: number })?.gems ?? 0));
    const newGems = currentGems + amount;
    const newEventXp = eventXp - xpCost;
    const now = new Date().toISOString();

    await supabase
      .from('sugoroku_progress')
      .update({ event_xp: newEventXp, updated_at: now })
      .eq('user_id', user.id);
    await supabase
      .from('profiles')
      .update({ gems: newGems, updated_at: now })
      .eq('user_id', user.id);

    return NextResponse.json({
      ok: true,
      spentXp: xpCost,
      receivedGems: amount,
      newEventXp,
      newGems,
    });
  } catch (err) {
    console.error('[sugoroku convert]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
