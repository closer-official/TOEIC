import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


/** POST: 1プレイ終了時。Cookie のセッションで RLS を通して同じ DB に保存する。
 * body: { userId, score, totalTimeMs, game_mode?, survival_rank?, checkpoints? }
 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const supabase = await createApiSupabaseClient();
  const { user } = await getApiUser(supabase);
  const uid = user?.id ?? null;
  if (!uid) {
    return NextResponse.json({ error: 'not_logged_in', message: 'ランキングに記録するにはログインしてください。' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    userId,
    score,
    totalTimeMs,
    game_mode = 'part5',
    survival_rank = 'ACE',
    checkpoints = null,
    question_ids = null,
  } = body;

  if (userId !== uid) {
    return NextResponse.json({ error: 'user_mismatch' }, { status: 403 });
  }
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return NextResponse.json({ error: 'Missing or invalid score' }, { status: 400 });
  }
  const totalMs = typeof totalTimeMs === 'number' && Number.isFinite(totalTimeMs) ? totalTimeMs : 0;
  const mode = game_mode === 'vocab' ? 'vocab' : 'part5';
  const rank = survival_rank === 'LEGEND' || survival_rank === 'ROOKIE' ? survival_rank : 'ACE';

  const row: Record<string, unknown> = {
    user_id: uid,
    score: Math.round(score),
    total_time_ms: totalMs,
    game_mode: mode,
    survival_rank: rank,
  };
  if (Array.isArray(checkpoints) && checkpoints.length > 0) {
    row.checkpoints = checkpoints;
  }
  if (mode === 'part5' && Array.isArray(question_ids)) {
    const ids = question_ids.filter((id: unknown) => typeof id === 'string').slice(0, 500);
    if (ids.length > 0) {
      row.run_question_ids = ids;
    }
  }

  const { error } = await supabase.from('runs').insert(row);
  if (error) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** GET: 全国ランキング（旧形式・単一モード混在）。combined API を推奨。 */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const supabase = await createApiSupabaseClient();
  const limit = Math.min(100, Math.max(10, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)));
  const { data, error } = await supabase
    .from('runs')
    .select('id, user_id, score, total_time_ms, created_at')
    .order('score', { ascending: false })
    .order('total_time_ms', { ascending: true })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
