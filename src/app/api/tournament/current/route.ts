import { NextResponse } from 'next/server';
import { getCurrentWeekSunday, parseTournamentRules } from '@/lib/tournament';
import { createApiSupabaseClient } from '@/lib/api-auth';

export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const startDate = getCurrentWeekSunday();
    const { data: row, error } = await supabase
      .from('tournament_weeks')
      .select('id, start_date, prize_label, prize_yen, rules_enabled, rules')
      .eq('start_date', startDate)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rules = parseTournamentRules(row?.rules_enabled ?? false, row?.rules ?? null);
    return NextResponse.json({
      id: row?.id ?? null,
      startDate: row?.start_date ?? startDate,
      prizeLabel: row?.prize_label ?? '',
      prizeYen: row?.prize_yen ?? null,
      rulesEnabled: rules.rulesEnabled,
      rules,
    });
  } catch (e) {
    console.error('[tournament/current]', e);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
