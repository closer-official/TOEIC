import { NextRequest, NextResponse } from 'next/server';
import { pickGachaEquipment } from '@/lib/equipment-items';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


/** 日本標準時で今日の日付 YYYY-MM-DD */
function getTodayJST(): string {
  const jst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return jst.toISOString().slice(0, 10);
}

/** アイテムは廃止。ルーレットでは装備のみ排出する。 */

/** プランごとの無料回数/日 */
function getFreePullsPerDay(tier: 'free' | 'pro' | 'ultra'): number {
  if (tier === 'ultra') return 5;
  if (tier === 'pro') return 3;
  return 1;
}

/** POST: ガチャを引く。body: { type: 'free' | 'paid' } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const type = body?.type === 'paid' ? 'paid' : 'free';

    type ProfileRow = {
      subscription_tier?: string;
      is_subscriber?: boolean;
      gacha_free_pulls_used_today?: number;
      gacha_free_reset_date?: string;
      free_gacha_ticket_pulls?: number;
    } | null;
    let profile: ProfileRow = null;
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('subscription_tier, is_subscriber, gacha_free_pulls_used_today, gacha_free_reset_date, free_gacha_ticket_pulls')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!profileErr) profile = profileData as ProfileRow;

    const rawTier = profile?.subscription_tier;
    const isSubscriber = Boolean(profile?.is_subscriber);
    const tier: 'free' | 'pro' | 'ultra' =
      rawTier === 'ultra' ? 'ultra' : rawTier === 'pro' ? 'pro' : isSubscriber ? 'pro' : 'free';

    const rateMultiplier = tier === 'pro' || tier === 'ultra' ? 1.2 : 1;
    const freePullsPerDay = getFreePullsPerDay(tier);
    const today = getTodayJST();

    if (type === 'free') {
      const ticketPulls = Math.max(0, profile?.free_gacha_ticket_pulls ?? 0);
      let used = profile?.gacha_free_pulls_used_today ?? 0;
      const resetDate = profile?.gacha_free_reset_date;

      if (resetDate !== today) {
        used = 0;
      }

      const useTicket = ticketPulls > 0;
      if (!useTicket && used >= freePullsPerDay) {
        return NextResponse.json(
          { error: '今日の無料回数を使い切りました。明日0:00にリセットされます。' },
          { status: 402 }
        );
      }

      const equipment = pickGachaEquipment();
      const now = new Date().toISOString();

      const { error: insertEquipErr } = await supabase.from('user_equipment').insert({
        user_id: user.id,
        equipment_id: equipment.id,
        quantity: 1,
        grade: 'common',
        level: 0,
        effect_base: 1,
      });
      if (insertEquipErr) {
        console.warn('[gacha pull] equipment insert', insertEquipErr.message);
        // user_equipment未作成時は装備だけスキップして続行
      }

      const updatePayload: { gacha_free_pulls_used_today?: number; gacha_free_reset_date?: string; free_gacha_ticket_pulls?: number; updated_at: string } = {
        updated_at: now,
      };
      if (useTicket) {
        updatePayload.free_gacha_ticket_pulls = ticketPulls - 1;
      } else {
        updatePayload.gacha_free_pulls_used_today = used + 1;
        updatePayload.gacha_free_reset_date = today;
      }
      const { error: updErr } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('user_id', user.id);
      if (updErr) {
        console.error('[gacha pull] free used update failed:', updErr.message);
        return NextResponse.json(
          { error: '本日の無料回数の記録に失敗しました。しばらく経ってからお試しください。' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        equipment: { id: equipment.id, name: equipment.name, slotLabel: equipment.slotLabel, trait: equipment.trait, rarity: equipment.rarity, effect: equipment.effect },
      });
    }

    // type === 'paid': 1回100チップ、10連900チップ
    const pullCount = Math.min(10, Math.max(1, Math.floor(Number(body?.count) || 1)));
    const GEM_COST_1 = 100;
    const GEM_COST_10 = 900;
    const totalCost = pullCount === 10 ? GEM_COST_10 : GEM_COST_1 * pullCount;

    let currentGems = 0;
    let pityCount = 0;

    let paidTicketPulls = 0;
    const { data: gemProfile, error: gemErr } = await supabase
      .from('profiles')
      .select('gems, paid_gacha_pity_count, paid_gacha_ticket_pulls')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!gemErr && gemProfile) {
      currentGems = Math.max(0, (gemProfile as { gems?: number }).gems ?? 0);
      pityCount = Math.min(99, Math.max(0, (gemProfile as { paid_gacha_pity_count?: number }).paid_gacha_pity_count ?? 0));
      paidTicketPulls = Math.max(0, (gemProfile as { paid_gacha_ticket_pulls?: number }).paid_gacha_ticket_pulls ?? 0);
    } else {
      const { data: gemsOnly } = await supabase
        .from('profiles')
        .select('gems, paid_gacha_ticket_pulls')
        .eq('user_id', user.id)
        .maybeSingle();
      currentGems = Math.max(0, (gemsOnly as { gems?: number } | null)?.gems ?? 0);
      paidTicketPulls = Math.max(0, (gemsOnly as { paid_gacha_ticket_pulls?: number } | null)?.paid_gacha_ticket_pulls ?? 0);
    }

    const useTickets = pullCount <= paidTicketPulls;
    if (useTickets) {
      // 有償チケットで全回数まかなう（1回＝1チケット、10回＝10チケット）
    } else if (currentGems < totalCost) {
      return NextResponse.json(
        { error: `チップが足りません。${pullCount === 10 ? `${GEM_COST_10}` : `${GEM_COST_1}×${pullCount}`}チップ必要です。（所持: ${currentGems}）` },
        { status: 402 }
      );
    }

    /** 有償ガチャ: 天井は「50回以内にLv16～20が出なかった場合」のみ。装備のレアリティは天井に含めない。 */
    const PITY_MAX = 50;
    /** レベル帯: 0–10が90%・11–15が9%・16–20が1%（等分）。メンバー/VIPは16–20を1.2倍にし、その分0–10を減らす。 */
    const rateLv16_20 = 0.01 * rateMultiplier;
    const rateLv11_15 = 0.09;
    const rateLv0_10 = Math.max(0, 1 - rateLv11_15 - rateLv16_20);

    const now = new Date().toISOString();
    const results: { equipment: { id: string; name: string; slotLabel: string; trait: string; rarity: string; effect: string; level: number } }[] = [];
    let runningPity = pityCount;

    for (let i = 0; i < pullCount; i++) {
      const equipment = pickGachaEquipment();
      const forceHigh = runningPity >= PITY_MAX;
      let level: number;
      if (forceHigh) {
        level = 16 + Math.floor(Math.random() * 5);
        runningPity = 0;
      } else {
        const r = Math.random();
        if (r < rateLv0_10) {
          level = Math.floor(Math.random() * 11);
        } else if (r < rateLv0_10 + rateLv11_15) {
          level = 11 + Math.floor(Math.random() * 5);
        } else {
          level = 16 + Math.floor(Math.random() * 5);
        }
        runningPity = level >= 16 ? 0 : runningPity + 1;
      }

      const { error: insertEquipErr } = await supabase.from('user_equipment').insert({
        user_id: user.id,
        equipment_id: equipment.id,
        quantity: 1,
        grade: 'common',
        level,
        effect_base: 1,
      });
      if (insertEquipErr) {
        console.warn('[gacha pull] paid equipment insert', insertEquipErr.message);
      }

      results.push({
        equipment: { id: equipment.id, name: equipment.name, slotLabel: equipment.slotLabel, trait: equipment.trait, rarity: equipment.rarity, effect: equipment.effect, level },
      });
    }

    const gemUpdate: { gems: number; updated_at: string; paid_gacha_pity_count?: number; paid_gacha_ticket_pulls?: number } = {
      gems: useTickets ? currentGems : currentGems - totalCost,
      updated_at: now,
    };
    gemUpdate.paid_gacha_pity_count = runningPity;
    if (useTickets) {
      gemUpdate.paid_gacha_ticket_pulls = paidTicketPulls - pullCount;
    }

    const { error: gemUpdErr } = await supabase
      .from('profiles')
      .update(gemUpdate)
      .eq('user_id', user.id);

    if (gemUpdErr) {
      console.error('[gacha pull] gems deduct failed:', gemUpdErr.message);
      return NextResponse.json(
        { error: 'チップの消費に失敗しました。プロフィールのgemsカラムを確認してください。' },
        { status: 500 }
      );
    }

    if (pullCount === 1) {
      const r = results[0]!;
      return NextResponse.json({
        ok: true,
        equipment: r.equipment,
        paidGachaPity: runningPity,
      });
    }

    return NextResponse.json({
      ok: true,
      results: results.map((r) => ({ equipment: r.equipment })),
      paidGachaPity: runningPity,
    });
  } catch (err) {
    console.error('[gacha pull]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
