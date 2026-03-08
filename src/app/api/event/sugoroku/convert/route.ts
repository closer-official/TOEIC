import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, getCurrentWeekIndex } from '@/lib/weekly-events';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** 10 全共通XP → 1 チップ */
const XP_PER_GEM = 10;

/** POST: 全共通XPをチップに換金。body: { amount } (チップ数。amount*10 の全共通XPを消費) */
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems, evolution_points')
      .eq('user_id', user.id)
      .maybeSingle();
    const prof = profile as { gems?: number; evolution_points?: number } | null;
    const currentCommonXp = Math.max(0, Math.floor(Number(prof?.evolution_points ?? 0)));
    if (currentCommonXp < xpCost) {
      return NextResponse.json({
        error: `全共通XPが足りません（必要: ${xpCost}、所持: ${currentCommonXp}）`,
      }, { status: 400 });
    }

    const currentGems = Math.floor(Number(prof?.gems ?? 0));
    const newGems = currentGems + amount;
    const newCommonXp = currentCommonXp - xpCost;
    const now = new Date().toISOString();

    await supabase
      .from('profiles')
      .update({ gems: newGems, evolution_points: newCommonXp, updated_at: now })
      .eq('user_id', user.id);

    return NextResponse.json({
      ok: true,
      spentXp: xpCost,
      receivedGems: amount,
      newCommonXp,
      newGems,
    });
  } catch (err) {
    console.error('[sugoroku convert]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
