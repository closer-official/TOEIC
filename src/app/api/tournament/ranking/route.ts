import { NextResponse } from 'next/server';
import { getCurrentWeekSunday } from '@/lib/tournament';
import { createApiSupabaseClient } from '@/lib/api-auth';

/** GET: 今週の大会ランキング（Part5+単語の合計スコア順）。認証不要。 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const supabase = await createApiSupabaseClient();

  const startDate = getCurrentWeekSunday();
  const { data: weekRow } = await supabase
    .from('tournament_weeks')
    .select('id')
    .eq('start_date', startDate)
    .maybeSingle();
  if (!weekRow?.id) {
    return NextResponse.json({ ranking: [], startDate });
  }

  const { data: runs } = await supabase
    .from('tournament_runs')
    .select('user_id, slot, score')
    .eq('tournament_week_id', weekRow.id);
  const byUser: Record<string, { part5: number; vocab: number }> = {};
  for (const r of runs ?? []) {
    const uid = (r as { user_id: string }).user_id;
    if (!byUser[uid]) byUser[uid] = { part5: 0, vocab: 0 };
    if ((r as { slot: string }).slot === 'part5') byUser[uid].part5 = (r as { score: number }).score;
    else byUser[uid].vocab = (r as { score: number }).score;
  }
  const userIds = Object.keys(byUser);
  const totals = userIds.map((uid) => ({
    user_id: uid,
    total: byUser[uid].part5 + byUser[uid].vocab,
    part5: byUser[uid].part5,
    vocab: byUser[uid].vocab,
  }));
  totals.sort((a, b) => b.total - a.total);
  const top = totals.slice(0, 50);
  const ids = top.map((t) => t.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_url')
    .in('user_id', ids);
  const profileByUserId = new Map(
    (profiles ?? []).map((p) => [(p as { user_id: string }).user_id, p])
  );
  const ranking = top.map((t, i) => ({
    rank: i + 1,
    user_id: t.user_id,
    username: (profileByUserId.get(t.user_id) as { username?: string } | undefined)?.username ?? null,
    avatar_url: (profileByUserId.get(t.user_id) as { avatar_url?: string } | undefined)?.avatar_url ?? null,
    part5_score: t.part5,
    vocab_score: t.vocab,
    total_score: t.total,
  }));
  return NextResponse.json({ ranking, startDate });
}
