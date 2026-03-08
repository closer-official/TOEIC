import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { computeCurrentStamina, getMaxStamina, isValidStaminaConsumeAmount } from '@/lib/stamina';
import { addEvolutionXp } from '@/lib/evolution-add-xp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

type SubscriptionTier = 'free' | 'pro' | 'ultra';

async function getStaminaProfile(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const fullCols = 'stamina_count, last_stamina_at, is_subscriber, evolution_wrong_penalty, evolution_season_carry_wrong_penalty, subscription_tier, stamina_infinity_ends_at';
  const { data, error } = await supabase.from('profiles').select(fullCols).eq('user_id', userId).maybeSingle();
  if (!error && data) {
    const rawTier = (data as { subscription_tier?: string | null }).subscription_tier;
    const isSubscriber = Boolean((data as { is_subscriber?: boolean }).is_subscriber);
    const wrongPenalty = (data as { evolution_wrong_penalty?: number }).evolution_wrong_penalty ?? 0;
    const carryWrong = (data as { evolution_season_carry_wrong_penalty?: number }).evolution_season_carry_wrong_penalty ?? 0;
    const recoverySpeedMultiplier = 1 + 0.01 * Math.min(10, wrongPenalty) + (carryWrong >= 0.01 ? 0.01 : 0);
    return {
      staminaCount: (data as { stamina_count?: number }).stamina_count ?? 10,
      lastStaminaAt: (data as { last_stamina_at?: string | null }).last_stamina_at ?? null,
      subscriptionTier: (rawTier === 'pro' || rawTier === 'ultra' ? rawTier : isSubscriber ? 'pro' : 'free') as SubscriptionTier,
      evolutionStaminaBonus: 0,
      recoverySpeedMultiplier,
      staminaInfinityEndsAt: (data as { stamina_infinity_ends_at?: string | null }).stamina_infinity_ends_at ?? null,
    };
  }
  const { data: minimal, error: minimalErr } = await supabase.from('profiles').select('stamina_count, last_stamina_at, stamina_infinity_ends_at').eq('user_id', userId).maybeSingle();
  if (minimalErr || !minimal) return null;
  return {
    staminaCount: (minimal as { stamina_count?: number }).stamina_count ?? 10,
    lastStaminaAt: (minimal as { last_stamina_at?: string | null }).last_stamina_at ?? null,
    subscriptionTier: 'free' as SubscriptionTier,
    evolutionStaminaBonus: 0,
    recoverySpeedMultiplier: 1,
    staminaInfinityEndsAt: (minimal as { stamina_infinity_ends_at?: string | null }).stamina_infinity_ends_at ?? null,
  };
}

async function getGuildStaminaBonus(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<number> {
  try {
    const { data: member } = await supabase.from('guild_members').select('guild_id').eq('user_id', userId).maybeSingle();
    if (!member) return 0;
    const { data: guild, error } = await supabase.from('guilds').select('lab_stamina_lv').eq('id', (member as { guild_id: string }).guild_id).maybeSingle();
    if (error || !guild) return 0;
    return ((guild as { lab_stamina_lv?: number }).lab_stamina_lv ?? 0) * 5;
  } catch {
    return 0;
  }
}

type OfflineRunItem = {
  id: string;
  score: number;
  totalTimeMs: number;
  game_mode: 'vocab' | 'part5';
  staminaAmount: number;
  survival_rank?: string;
  checkpoints?: unknown;
  question_ids?: string[] | null;
  scoreToShow: number;
  epMult: number;
};

/** POST: オフラインで溜めた run を一括同期。冪等。body: { runs: OfflineRunItem[] } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // ignore
        }
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'not_logged_in', message: 'ログインしてください' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const runs = Array.isArray((body as { runs?: OfflineRunItem[] }).runs) ? (body as { runs: OfflineRunItem[] }).runs : [];
  const processedIds: string[] = [];
  let insufficientStaminaFromId: string | undefined;

  for (const run of runs) {
    if (!run?.id || typeof run.score !== 'number' || typeof run.totalTimeMs !== 'number') continue;
    const amount = isValidStaminaConsumeAmount(run.staminaAmount) ? run.staminaAmount : 5;

    const { data: existing } = await supabase.from('offline_synced_run_ids').select('client_run_id').eq('client_run_id', run.id).eq('user_id', user.id).maybeSingle();
    if (existing) {
      processedIds.push(run.id);
      continue;
    }

    const profile = await getStaminaProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: 'profile_fetch_failed', processedIds }, { status: 502 });
    }

    const infinityEndsAt = profile.staminaInfinityEndsAt ?? null;
    const hasInfinity = infinityEndsAt && new Date(infinityEndsAt) > new Date();
    let newStaminaCount = profile.staminaCount;
    if (!hasInfinity) {
      const guildBonus = await getGuildStaminaBonus(supabase, user.id);
      const totalBonus = profile.evolutionStaminaBonus + guildBonus;
      const { stamina } = computeCurrentStamina(
        profile.staminaCount,
        profile.lastStaminaAt,
        profile.subscriptionTier,
        totalBonus,
        profile.recoverySpeedMultiplier ?? 1
      );
      if (stamina < amount) {
        insufficientStaminaFromId = run.id;
        break;
      }
      newStaminaCount = stamina - amount;
    }

    const now = new Date().toISOString();
    const { error: updateStaminaErr } = await supabase
      .from('profiles')
      .update({
        stamina_count: newStaminaCount,
        last_stamina_at: now,
        updated_at: now,
      })
      .eq('user_id', user.id);
    if (updateStaminaErr) {
      return NextResponse.json({ error: updateStaminaErr.message, processedIds }, { status: 500 });
    }

    const mode = run.game_mode === 'vocab' ? 'vocab' : 'part5';
    const rank = run.survival_rank === 'LEGEND' || run.survival_rank === 'ROOKIE' ? run.survival_rank : 'ACE';
    const runRow: Record<string, unknown> = {
      user_id: user.id,
      score: Math.round(run.score),
      total_time_ms: typeof run.totalTimeMs === 'number' && Number.isFinite(run.totalTimeMs) ? run.totalTimeMs : 0,
      game_mode: mode,
      survival_rank: rank,
    };
    if (Array.isArray(run.checkpoints) && run.checkpoints.length > 0) runRow.checkpoints = run.checkpoints;
    if (mode === 'part5' && Array.isArray(run.question_ids)) {
      const ids = run.question_ids.filter((id: unknown) => typeof id === 'string').slice(0, 500);
      if (ids.length > 0) runRow.run_question_ids = ids;
    }

    const { error: insertRunErr } = await supabase.from('runs').insert(runRow);
    if (insertRunErr) {
      return NextResponse.json({ error: insertRunErr.message, processedIds }, { status: 500 });
    }

    const gameModeForXp = run.game_mode === 'part5' ? 'part5-national' : 'vocab-national';
    try {
      await addEvolutionXp(supabase, user.id, {
        score: run.scoreToShow,
        gameMode: gameModeForXp,
        epMult: run.epMult,
        staminaAmount: amount,
      });
    } catch (e) {
      console.error('[offline-sync] evolution add failed:', e);
      // run は挿入済みなので続行
    }

    await supabase.from('offline_synced_run_ids').insert({
      client_run_id: run.id,
      user_id: user.id,
      created_at: now,
    });
    processedIds.push(run.id);
  }

  return NextResponse.json({
    ok: true,
    processedIds,
    ...(insufficientStaminaFromId != null && { insufficientStaminaFromId }),
  });
}
