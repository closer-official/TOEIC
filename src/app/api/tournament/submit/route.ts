import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWeekSunday, isTournamentWindowNow } from '@/lib/tournament';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  if (!isTournamentWindowNow()) {
    return NextResponse.json({ error: '大会の受付時間外です（日曜 12:00〜23:00 JST）' }, { status: 403 });
  }
  const supabase = await createApiSupabaseClient();
  const { user, authError } = await getApiUser(supabase);
  if (authError || !user) {
    return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  }
  let body: { slot?: string; score?: number; totalTimeMs?: number; run_question_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const slot = body.slot === 'part5' || body.slot === 'vocab' ? body.slot : null;
  const score = typeof body.score === 'number' && Number.isFinite(body.score) ? Math.max(0, Math.round(body.score)) : null;
  const totalTimeMs = typeof body.totalTimeMs === 'number' && Number.isFinite(body.totalTimeMs) ? Math.max(0, Math.round(body.totalTimeMs)) : 0;
  const runQuestionIds = Array.isArray(body.run_question_ids) ? body.run_question_ids.filter((id: unknown) => typeof id === 'string') : [];
  if (!slot || score === null) {
    return NextResponse.json({ error: 'slot (part5|vocab) と score が必要です' }, { status: 400 });
  }
  const startDate = getCurrentWeekSunday();
  const { data: weekRow, error: weekErr } = await supabase
    .from('tournament_weeks')
    .select('id')
    .eq('start_date', startDate)
    .maybeSingle();
  if (weekErr || !weekRow?.id) {
    return NextResponse.json({ error: '今週の大会が設定されていません' }, { status: 404 });
  }
  const { error: insertErr } = await supabase.from('tournament_runs').insert({
    tournament_week_id: weekRow.id,
    user_id: user.id,
    slot,
    score,
    total_time_ms: totalTimeMs,
    run_question_ids: runQuestionIds.length > 0 ? runQuestionIds : [],
  });
  if (insertErr) {
    if (/unique|duplicate/i.test(insertErr.message)) {
      return NextResponse.json({ error: slot === 'part5' ? 'Part5は今週すでにプレイ済みです' : '単語は今週すでにプレイ済みです' }, { status: 409 });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slot, score });
}
