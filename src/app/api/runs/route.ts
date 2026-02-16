import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** POST: { userId, score, totalTimeMs } — 1プレイ終了時 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();
  const { userId, score, totalTimeMs } = body;
  if (!userId || typeof score !== 'number' || typeof totalTimeMs !== 'number') {
    return NextResponse.json({ error: 'Missing userId, score, or totalTimeMs' }, { status: 400 });
  }
  const { error } = await supabase.from('runs').insert({
    user_id: userId,
    score,
    total_time_ms: totalTimeMs,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** GET: 全国ランキング（スコア降順・同点なら時間昇順）、?limit=20 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
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
