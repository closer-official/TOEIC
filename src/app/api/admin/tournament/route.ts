import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../auth';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { getCurrentWeekSunday } from '@/lib/tournament';
import { getDefaultTournamentRules, parseTournamentRules, type TournamentRules } from '@/lib/tournament';

/** GET: 今週の大会設定を取得。なければ作成して返す。 */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const err = requireAdmin(req);
  if (err) return err;
  try {
    const supabase = createAdminSupabaseClient();
    const startDate = getCurrentWeekSunday();
    const { data: row, error } = await supabase
      .from('tournament_weeks')
      .select('id, start_date, prize_label, prize_yen, rules_enabled, rules, winner_user_id, winner_email_display')
      .eq('start_date', startDate)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (row) {
      const rules = parseTournamentRules(row.rules_enabled, row.rules);
      return NextResponse.json({
        id: row.id,
        startDate: row.start_date,
        prizeLabel: row.prize_label ?? '',
        prizeYen: row.prize_yen ?? null,
        rulesEnabled: rules.rulesEnabled,
        rules,
        winnerUserId: row.winner_user_id ?? null,
        winnerEmailDisplay: row.winner_email_display ?? null,
      });
    }
    const defaultRules = getDefaultTournamentRules();
    const { data: inserted, error: insertErr } = await supabase
      .from('tournament_weeks')
      .insert({
        start_date: startDate,
        prize_label: '',
        prize_yen: null,
        rules_enabled: false,
        rules: {
          equipment: defaultRules.equipment,
          personalGrowth: defaultRules.personalGrowth,
          guildGrowth: defaultRules.guildGrowth,
        },
      })
      .select('id, start_date, prize_label, prize_yen, rules_enabled, rules')
      .single();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    const rules = parseTournamentRules(inserted.rules_enabled, inserted.rules);
    return NextResponse.json({
      id: inserted.id,
      startDate: inserted.start_date,
      prizeLabel: inserted.prize_label ?? '',
      prizeYen: inserted.prize_yen ?? null,
      rulesEnabled: rules.rulesEnabled,
      rules,
      winnerUserId: null,
      winnerEmailDisplay: null,
    });
  } catch (e) {
    console.error('[admin/tournament GET]', e);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** PUT: 今週の大会設定（賞品・ルール）を保存。 */
export async function PUT(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const err = requireAdmin(req);
  if (err) return err;
  try {
    const body = await req.json();
    const { prizeLabel, prizeYen, rulesEnabled, rules } = body as {
      prizeLabel?: string;
      prizeYen?: number | null;
      rulesEnabled?: boolean;
      rules?: TournamentRules;
    };
    const supabase = createAdminSupabaseClient();
    const startDate = getCurrentWeekSunday();
    const { data: existing } = await supabase
      .from('tournament_weeks')
      .select('id')
      .eq('start_date', startDate)
      .maybeSingle();
    const payload = {
      prize_label: prizeLabel ?? '',
      prize_yen: prizeYen ?? null,
      rules_enabled: Boolean(rulesEnabled),
      rules: rules ? { equipment: rules.equipment, personalGrowth: rules.personalGrowth, guildGrowth: rules.guildGrowth } : {},
      updated_at: new Date().toISOString(),
    };
    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from('tournament_weeks')
        .update(payload)
        .eq('id', existing.id);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: existing.id });
    }
    const { data: inserted, error: insertErr } = await supabase
      .from('tournament_weeks')
      .insert({
        start_date: startDate,
        ...payload,
      })
      .select('id')
      .single();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (e) {
    console.error('[admin/tournament PUT]', e);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
