import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

/** GET: 同一モード・ランクの自己ベスト1件（ゴースト用 checkpoints 付き） */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const supabase = await createApiSupabaseClient();
  const { user, authError } = await getApiUser(supabase);

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
