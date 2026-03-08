import { NextResponse } from 'next/server';
import { getCurrentWeekSunday, parseTournamentRules } from '@/lib/tournament';
import { createApiSupabaseClient } from '@/lib/api-auth';

export const dynamic = 'force-static';

/** ゲーム開始時に参照するルールのみ。軽量。 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const startDate = getCurrentWeekSunday();
    const { data: row, error } = await supabase
      .from('tournament_weeks')
      .select('rules_enabled, rules')
      .eq('start_date', startDate)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rules = parseTournamentRules(row?.rules_enabled ?? false, row?.rules ?? null);
    return NextResponse.json({ rulesEnabled: rules.rulesEnabled, rules });
  } catch (e) {
    console.error('[tournament/current-rules]', e);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
