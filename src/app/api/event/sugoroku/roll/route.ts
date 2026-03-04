import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, getCurrentWeekIndex } from '@/lib/weekly-events';
import {
  BOARD_SPACES,
  getSpace,
  rollDice,
  randomInRange,
  LAP_FRAGMENT_BONUS_AT,
  TOTAL_SPACES,
} from '@/lib/sugoroku-board';
import { computeCurrentStamina, getMaxStamina, type SubscriptionTier } from '@/lib/stamina';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** POST: サイコロを振る。body: { useGoldenDice?: number } (1-6 で出目指定)。 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
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

    const isPreview = req.headers.get('x-preview') === '1' || req.headers.get('x-dev') === '1';
    if (getCurrentEvent().id !== 'sugoroku' && !isPreview) {
      return NextResponse.json({ error: '今週は運命のすごろくではありません' }, { status: 404 });
    }

    const weekIndex = getCurrentWeekIndex();
    const body = await req.json().catch(() => ({}));
    const useGoldenDice = typeof body?.useGoldenDice === 'number' && body.useGoldenDice >= 1 && body.useGoldenDice <= 6
      ? body.useGoldenDice
      : null;

    const { data: progress } = await supabase
      .from('sugoroku_progress')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const p = progress as {
      event_week_index?: number;
      position?: number;
      dice_count?: number;
      lap_count?: number;
      fragments?: number;
      event_xp?: number;
      trap_guard?: boolean;
      golden_dice_count?: number;
    } | null;

    if (!p || (p.event_week_index ?? 0) !== weekIndex) {
      return NextResponse.json({ error: '進行状態を取得してください' }, { status: 400 });
    }

    let position = Math.max(1, Math.min(TOTAL_SPACES, p.position ?? 1));
    let diceCount = Math.max(0, p.dice_count ?? 0);
    let lapCount = p.lap_count ?? 0;
    let fragments = p.fragments ?? 0;
    let eventXp = p.event_xp ?? 0;
    let trapGuard = Boolean(p.trap_guard);
    let goldenDiceCount = Math.max(0, p.golden_dice_count ?? 0);

    let steps: number;
    if (useGoldenDice !== null) {
      if (goldenDiceCount < 1) {
        return NextResponse.json({ error: '黄金のダイスがありません' }, { status: 400 });
      }
      steps = useGoldenDice;
      goldenDiceCount -= 1;
    } else {
      if (diceCount < 1) {
        return NextResponse.json({ error: 'サイコロがありません。100チップで1個購入可能' }, { status: 400 });
      }
      steps = rollDice();
      diceCount -= 1;
    }

    const passedStart = position + steps > TOTAL_SPACES;
    let newPos = position + steps;
    if (newPos > TOTAL_SPACES) {
      lapCount += 1;
      newPos -= TOTAL_SPACES;
    }

    if (passedStart) {
      eventXp += 500; // 通過時 500 XP
    }

    const space = getSpace(newPos);
    const messages: string[] = [];
    let gemsDelta = 0;

    if (space) {
      if (space.kind === 'hell_slippery') {
        if (trapGuard) {
          trapGuard = false;
          messages.push('トラップガードで地獄を無効化！');
        } else {
          newPos = Math.max(1, newPos - 2);
          messages.push('2マス戻った…');
        }
      } else if (space.kind === 'black_hole') {
        const goToPos = space.stopEffect?.goTo ?? 5;
        newPos = goToPos;
        const targetSpace = getSpace(goToPos);
        messages.push(`${goToPos}番${targetSpace?.name ?? 'ビュッフェ'}まで強制送還！`);
      } else if (space.kind === 'start') {
        diceCount += 1;
        messages.push('サイコロ+1');
      } else if (space.kind === 'eternal_altar') {
        fragments += 1;
        messages.push('エターナル素材の欠片を1個獲得！');
      } else if (space.kind === 'trap_guard') {
        trapGuard = true;
        messages.push('トラップガードを獲得');
      } else if (space.kind === 'last_gamble') {
        if (Math.random() < 0.5) {
          diceCount += 1;
          messages.push('ラスト・ギャンブル：サイコロ+1！');
        } else {
          eventXp = Math.max(0, eventXp - 1000);
          messages.push('ラスト・ギャンブル：1,000 全共通XP没収…');
        }
      } else if (space.kind === 'buffet') {
        messages.push('スタミナ10回復');
      } else if (space.kind === 'gambling') {
        if (space.num % 2 === 1 && space.gemsRange) {
          gemsDelta = randomInRange(space.gemsRange[0], space.gemsRange[1]);
          messages.push(`${gemsDelta} チップ獲得`);
        } else {
          const xpLoss = space.stopEffect?.eventXp ?? -200;
          eventXp = Math.max(0, eventXp + xpLoss);
          messages.push(`${-xpLoss} 全共通XP没収`);
        }
      } else if (space.eventXpRange || space.gemsRange) {
        const useXp = space.eventXpRange && (!space.gemsRange || Math.random() < 0.5);
        if (useXp && space.eventXpRange) {
          const xp = randomInRange(space.eventXpRange[0], space.eventXpRange[1]);
          eventXp += xp;
          messages.push(`${xp} 全共通XP獲得`);
        } else if (space.gemsRange) {
          gemsDelta = randomInRange(space.gemsRange[0], space.gemsRange[1]);
          messages.push(`${gemsDelta} チップ獲得`);
        }
      } else if (space.stopEffect) {
        const eff = space.stopEffect;
        if (eff.dice) {
          diceCount += eff.dice;
          messages.push(`サイコロ+${eff.dice}`);
        }
        if (eff.eventXp !== undefined) {
          eventXp = Math.max(0, eventXp + eff.eventXp);
          if (eff.eventXp > 0) messages.push(`${eff.eventXp} 全共通XP獲得`);
          if (eff.eventXp < 0) messages.push(`${-eff.eventXp} 全共通XP没収`);
        }
        if (eff.gems) {
          gemsDelta = eff.gems;
          messages.push(`${gemsDelta} チップ獲得`);
        }
      }
    }

    // 周回ボーナス
    if (LAP_FRAGMENT_BONUS_AT.includes(lapCount)) {
      fragments += 1;
      messages.push(`${lapCount}周達成ボーナス：欠片+1`);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems, stamina_count, last_stamina_at, subscription_tier, is_subscriber')
      .eq('user_id', user.id)
      .maybeSingle();

    let gems = Math.floor(Number((profile as { gems?: number })?.gems ?? 0));
    gems += gemsDelta;

    const staminaCountDb = (profile as { stamina_count?: number })?.stamina_count ?? 10;
    const lastStaminaAt = (profile as { last_stamina_at?: string | null })?.last_stamina_at ?? null;
    const tier = ((profile as { subscription_tier?: string })?.subscription_tier === 'ultra' || (profile as { subscription_tier?: string })?.subscription_tier === 'pro')
      ? ((profile as { subscription_tier: string }).subscription_tier as SubscriptionTier)
      : 'free';
    const maxStamina = getMaxStamina(tier);
    const { stamina: currentStamina } = computeCurrentStamina(staminaCountDb, lastStaminaAt, tier);
    let newStaminaCount = staminaCountDb;
    if (space?.kind === 'buffet' && space.stopEffect?.stamina) {
      const add = space.stopEffect.stamina;
      newStaminaCount = Math.min(maxStamina, currentStamina + add);
    }

    // 借金時は獲得イベントXPを自動返済に充てる
    if (gems < 0 && eventXp >= 10) {
      const toRepay = Math.min(-gems, Math.floor(eventXp / 10));
      if (toRepay > 0) {
        const xpSpent = toRepay * 10;
        eventXp -= xpSpent;
        gems += toRepay;
        messages.push(`自動返済: ${xpSpent} 全共通XP → ${toRepay} チップ`);
      }
    }

    const now = new Date().toISOString();
    await supabase
      .from('sugoroku_progress')
      .update({
        event_week_index: weekIndex,
        position: newPos,
        dice_count: diceCount,
        lap_count: lapCount,
        fragments,
        event_xp: eventXp,
        trap_guard: trapGuard,
        golden_dice_count: goldenDiceCount,
        updated_at: now,
      })
      .eq('user_id', user.id);

    const profileUpdate: Record<string, unknown> = { updated_at: now, gems };
    if (space?.kind === 'buffet' && space.stopEffect?.stamina) {
      profileUpdate.stamina_count = newStaminaCount;
      profileUpdate.last_stamina_at = now;
    }
    await supabase.from('profiles').update(profileUpdate).eq('user_id', user.id);

    return NextResponse.json({
      ok: true,
      steps: useGoldenDice ?? steps,
      position: newPos,
      spaceName: space?.name,
      diceCount,
      lapCount,
      fragments,
      eventXp,
      trapGuard,
      goldenDiceCount,
      gems,
      canUseShop: gems >= 0,
      messages,
    });
  } catch (err) {
    console.error('[sugoroku roll]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
