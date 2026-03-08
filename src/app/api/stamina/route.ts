import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  computeCurrentStamina,
  getMaxStamina,
  STAMINA_MAX_FREE,
  STAMINA_CONSUME,
  isValidStaminaConsumeAmount,
  type SubscriptionTier,
} from '@/lib/stamina';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function getStaminaProfile(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const fullCols = 'stamina_count, last_stamina_at, is_subscriber, evolution_wrong_penalty, evolution_season_carry_wrong_penalty, subscription_tier, stamina_infinity_ends_at';
  const { data, error } = await supabase
    .from('profiles')
    .select(fullCols)
    .eq('user_id', userId)
    .maybeSingle();

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

  const { data: minimal, error: minimalErr } = await supabase
    .from('profiles')
    .select('stamina_count, last_stamina_at, stamina_infinity_ends_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (minimalErr || !minimal) {
    return null;
  }
  return {
    staminaCount: (minimal as { stamina_count?: number }).stamina_count ?? 10,
    lastStaminaAt: (minimal as { last_stamina_at?: string | null }).last_stamina_at ?? null,
    subscriptionTier: 'free' as SubscriptionTier,
    evolutionStaminaBonus: 0,
    recoverySpeedMultiplier: 1,
    staminaInfinityEndsAt: (minimal as { stamina_infinity_ends_at?: string | null }).stamina_infinity_ends_at ?? null,
  };
}

/** ギルドの巨大な貯蔵庫: 最大スタミナ +5/Lv、Lv.10継承で+5 */
async function getGuildStaminaBonus(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<number> {
  try {
    const { data: member } = await supabase
      .from('guild_members')
      .select('guild_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!member) return 0;
    const { data: guild, error } = await supabase
      .from('guilds')
      .select('lab_stamina_lv')
      .eq('id', (member as { guild_id: string }).guild_id)
      .maybeSingle();
    if (error || !guild) return 0;
    const g = guild as { lab_stamina_lv?: number };
    return (g.lab_stamina_lv ?? 0) * 5;
  } catch {
    return 0;
  }
}

/** GET: 現在スタミナ・最大・次回復時刻（ms）。?offline=1 で offlineMeta を付与（オフライン時ローカル計算用） */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const wantOfflineMeta = req.nextUrl.searchParams.get('offline') === '1';
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const profile = await getStaminaProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({
        stamina: STAMINA_MAX_FREE,
        maxStamina: STAMINA_MAX_FREE,
        nextRecoveryAt: null,
        recoveryIntervalMs: null,
      });
    }

    const guildStaminaBonus = await getGuildStaminaBonus(supabase, user.id);
    const totalStaminaBonus = profile.evolutionStaminaBonus + guildStaminaBonus;
    const maxStamina = getMaxStamina(profile.subscriptionTier) + totalStaminaBonus;
    const { stamina, nextRecoveryAt } = computeCurrentStamina(
      profile.staminaCount,
      profile.lastStaminaAt,
      profile.subscriptionTier,
      totalStaminaBonus,
      profile.recoverySpeedMultiplier ?? 1
    );
    const mult = profile.recoverySpeedMultiplier ?? 1;
    const recoveryIntervalMs = Math.max(
      60 * 1000,
      Math.floor((24 * 60 * 60 * 1000) / maxStamina) / mult
    );

    const payload: Record<string, unknown> = {
      stamina,
      maxStamina,
      nextRecoveryAt: nextRecoveryAt ?? null,
      recoveryIntervalMs: nextRecoveryAt != null ? recoveryIntervalMs : null,
    };
    if (wantOfflineMeta && profile) {
      payload.offlineMeta = {
        staminaCount: profile.staminaCount,
        lastStaminaAt: profile.lastStaminaAt,
        subscriptionTier: profile.subscriptionTier,
        evolutionStaminaBonus: totalStaminaBonus,
        recoverySpeedMultiplier: profile.recoverySpeedMultiplier ?? 1,
      };
    }
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[stamina] GET error:', err);
    return NextResponse.json(
      {
        stamina: STAMINA_MAX_FREE,
        maxStamina: STAMINA_MAX_FREE,
        nextRecoveryAt: null,
        recoveryIntervalMs: null,
      },
      { status: 200 }
    );
  }
}

/** POST: 5消費。body: {} */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const profile = await getStaminaProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({
        error: 'スタミナ情報を取得できませんでした',
        code: 'profile_fetch_failed',
        stamina: STAMINA_MAX_FREE,
        maxStamina: STAMINA_MAX_FREE,
        message: 'プロフィールまたは購読情報を取得できませんでした。ログアウトして再ログインするか、/api/profile/subscription-status で購読状態を確認してください。',
      }, { status: 502 });
    }

    const guildStaminaBonus = await getGuildStaminaBonus(supabase, user.id);
    const totalStaminaBonus = profile.evolutionStaminaBonus + guildStaminaBonus;
    const maxStamina = getMaxStamina(profile.subscriptionTier) + totalStaminaBonus;
    const { stamina, nextRecoveryAt } = computeCurrentStamina(
      profile.staminaCount,
      profile.lastStaminaAt,
      profile.subscriptionTier,
      totalStaminaBonus,
      profile.recoverySpeedMultiplier ?? 1
    );

    const infinityEndsAt = (profile as { staminaInfinityEndsAt?: string | null }).staminaInfinityEndsAt ?? null;
    const hasStaminaInfinity = infinityEndsAt && new Date(infinityEndsAt) > new Date();

    if (hasStaminaInfinity) {
      return NextResponse.json({
        ok: true,
        stamina,
        maxStamina,
        staminaInfinityActive: true,
      });
    }

    const body = await req.json().catch(() => ({}));
    const amount = isValidStaminaConsumeAmount((body as { amount?: number })?.amount) ? (body as { amount: number }).amount : STAMINA_CONSUME;

    if (stamina < amount) {
      return NextResponse.json(
        {
          error: 'スタミナが足りません',
          stamina,
          maxStamina,
          nextRecoveryAt: nextRecoveryAt ?? null,
        },
        { status: 402 }
      );
    }

    const newCount = stamina - amount;
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stamina_count: newCount,
        last_stamina_at: now,
        updated_at: now,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[stamina] POST update failed:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      stamina: newCount,
      maxStamina,
      consumed: amount,
    });
  } catch (err) {
    console.error('[stamina] POST error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

const CHIPS_PER_STAMINA = 4;

/** PATCH: チップでスタミナ回復。body: { action: 'recover', amount?: number }。1スタミナ＝4チップ。戻り値: { stamina, maxStamina, gems, recovered } */
export async function PATCH(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.action !== 'recover') {
      return NextResponse.json({ error: '無効なリクエストです' }, { status: 400 });
    }

    const amount = typeof body.amount === 'number' && body.amount >= 1 ? Math.floor(body.amount) : 1;

    const profile = await getStaminaProfile(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: 'スタミナ情報を取得できませんでした' }, { status: 502 });
    }

    const guildStaminaBonus = await getGuildStaminaBonus(supabase, user.id);
    const totalStaminaBonus = profile.evolutionStaminaBonus + guildStaminaBonus;
    const maxStamina = getMaxStamina(profile.subscriptionTier) + totalStaminaBonus;
    const { stamina } = computeCurrentStamina(
      profile.staminaCount,
      profile.lastStaminaAt,
      profile.subscriptionTier,
      totalStaminaBonus,
      profile.recoverySpeedMultiplier ?? 1
    );

    const canRecover = Math.max(0, maxStamina - stamina);
    if (canRecover <= 0) {
      return NextResponse.json(
        { error: 'スタミナはすでに満タンです', stamina, maxStamina },
        { status: 400 }
      );
    }

    const recoverCount = Math.min(amount, canRecover);
    const cost = recoverCount * CHIPS_PER_STAMINA;

    const { data: gemRow, error: gemErr } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .single();

    if (gemErr || !gemRow) {
      return NextResponse.json({ error: 'プロフィールを取得できませんでした' }, { status: 502 });
    }

    const currentGems = Math.max(0, (gemRow as { gems?: number }).gems ?? 0);
    if (currentGems < cost) {
      return NextResponse.json(
        {
          error: `チップが足りません。${recoverCount}スタミナ回復に${cost}チップ必要です。（所持: ${currentGems}）`,
          stamina,
          maxStamina,
          gems: currentGems,
        },
        { status: 402 }
      );
    }

    const newStaminaCount = stamina + recoverCount;
    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        stamina_count: newStaminaCount,
        last_stamina_at: now,
        gems: currentGems - cost,
        updated_at: now,
      })
      .eq('user_id', user.id);

    if (updateErr) {
      console.error('[stamina] PATCH update failed:', updateErr.message);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      stamina: newStaminaCount,
      maxStamina,
      gems: currentGems - cost,
      recovered: recoverCount,
      cost,
    });
  } catch (err) {
    console.error('[stamina] PATCH error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
