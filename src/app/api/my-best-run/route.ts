import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** GET: 同一モード・ランクの自己ベスト1件（ゴースト用 checkpoints 付き） */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
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

  const mode = req.nextUrl.searchParams.get('mode') ?? 'part5';
  const rank = req.nextUrl.searchParams.get('rank') ?? 'ACE';
  const modeKey = mode === 'vocab' ? 'vocab' : 'part5';
  const rankKey = ['ROOKIE', 'ACE', 'LEGEND'].includes(rank) ? rank : 'ACE';

  const { data: run } = await supabase
    .from('runs')
    .select('id, score, total_time_ms, checkpoints')
    .eq('user_id', user.id)
    .eq('game_mode', modeKey)
    .eq('survival_rank', rankKey)
    .order('score', { ascending: false })
    .order('total_time_ms', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!run) {
    return NextResponse.json({ run: null });
  }

  const checkpoints = Array.isArray(run.checkpoints)
    ? run.checkpoints
    : typeof run.checkpoints === 'object' && run.checkpoints !== null
      ? []
      : [];
  return NextResponse.json({
    run: {
      score: run.score,
      total_time_ms: run.total_time_ms,
      checkpoints: checkpoints as { q: number; t: number; remainingSec: number }[],
    },
  });
}
