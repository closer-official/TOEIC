import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCurrentWeekSunday } from '@/lib/tournament';

export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  }
  const startDate = getCurrentWeekSunday();
  const { data: weekRow } = await supabase.from('tournament_weeks').select('id').eq('start_date', startDate).maybeSingle();
  if (!weekRow?.id) return NextResponse.json({ part5: null, vocab: null });
  const { data: runs } = await supabase
    .from('tournament_runs')
    .select('slot, score, total_time_ms')
    .eq('tournament_week_id', weekRow.id)
    .eq('user_id', user.id);
  const part5 = runs?.find((r) => (r as { slot: string }).slot === 'part5') ?? null;
  const vocab = runs?.find((r) => (r as { slot: string }).slot === 'vocab') ?? null;
  return NextResponse.json({
    part5: part5 ? { score: (part5 as { score: number }).score, totalTimeMs: (part5 as { total_time_ms: number }).total_time_ms } : null,
    vocab: vocab ? { score: (vocab as { score: number }).score, totalTimeMs: (vocab as { total_time_ms: number }).total_time_ms } : null,
    total: ((part5 as { score: number } | null)?.score ?? 0) + ((vocab as { score: number } | null)?.score ?? 0),
  });
}
