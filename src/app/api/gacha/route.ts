import { NextResponse } from 'next/server';
import { GACHA_EQUIPMENT, getEquipmentDisplayRate } from '@/lib/equipment-items';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


/** アイテムは廃止。ルーレットでは装備のみ排出。排出率APIではアイテム一覧は空で返す。 */

/** 日本標準時で翌日0:00のタイムスタンプ（ms） */
function getNextMidnightJST(): number {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const next = new Date(jst);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  const offset = now.getTime() - jst.getTime();
  return next.getTime() + offset;
}

/** 日本標準時で今日 YYYY-MM-DD */
function getTodayJST(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    .toISOString()
    .slice(0, 10);
}

/** プランごとの無料回数/日: Free=1, Pro=3, Ultra=5 */
function getFreePullsPerDay(tier: 'free' | 'pro' | 'ultra'): number {
  if (tier === 'ultra') return 5;
  if (tier === 'pro') return 3;
  return 1;
}

/** GET: ガチャ状態（無料回数・次回無料時刻・会員）と排出アイテム一覧 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    let profile: { is_subscriber?: boolean; subscription_tier?: string; gacha_free_pulls_used_today?: number; gacha_free_reset_date?: string } | null = null;
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('is_subscriber, subscription_tier, gacha_free_pulls_used_today, gacha_free_reset_date')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!profileErr) profile = profileData as typeof profile;
    // gacha_free_* カラム未作成時は used=0 扱い

    const rawTier = (profile as { subscription_tier?: string } | null)?.subscription_tier;
    const isSubscriber = Boolean((profile as { is_subscriber?: boolean } | null)?.is_subscriber);
    const tier: 'free' | 'pro' | 'ultra' =
      rawTier === 'ultra' ? 'ultra' : rawTier === 'pro' ? 'pro' : isSubscriber ? 'pro' : 'free';

    const nextFreeAt = getNextMidnightJST();
    const today = getTodayJST();
    const freePullsPerDay = getFreePullsPerDay(tier);
    let used = (profile as { gacha_free_pulls_used_today?: number } | null)?.gacha_free_pulls_used_today ?? 0;
    const resetDate = (profile as { gacha_free_reset_date?: string } | null)?.gacha_free_reset_date;

    if (resetDate !== today) {
      used = 0;
    }
    const freePullsLeft = Math.max(0, freePullsPerDay - used);

    const rateMultiplier = tier === 'pro' || tier === 'ultra' ? 1.2 : 1;
    const items: { id: string; name: string; rarity: string; baseRate: number; currentRate: number }[] = [];
    const equipment = GACHA_EQUIPMENT.map((it) => ({
      id: it.id,
      name: it.name,
      slotLabel: it.slotLabel,
      trait: it.trait,
      rarity: it.rarity,
      baseRate: it.baseRate,
      currentRate: Math.round(getEquipmentDisplayRate(it) * 10) / 10,
    }));

    let paidGachaPity = 0;
    const { data: pityData, error: pityErr } = await supabase
      .from('profiles')
      .select('paid_gacha_pity_count')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!pityErr && pityData && typeof (pityData as { paid_gacha_pity_count?: number }).paid_gacha_pity_count === 'number') {
      paidGachaPity = Math.min(50, Math.max(0, (pityData as { paid_gacha_pity_count: number }).paid_gacha_pity_count));
    }

    return NextResponse.json({
      freePullsLeft,
      nextFreeAt,
      isSubscriber,
      rateMultiplier,
      items,
      equipment,
      paidGachaPity,
    });
  } catch (err) {
    console.error('[gacha] GET error:', err);
    const items: { id: string; name: string; rarity: string; baseRate: number; currentRate: number }[] = [];
    const equipment = GACHA_EQUIPMENT.map((it) => ({
      id: it.id,
      name: it.name,
      slotLabel: it.slotLabel,
      trait: it.trait,
      rarity: it.rarity,
      baseRate: it.baseRate,
      currentRate: Math.round(getEquipmentDisplayRate(it) * 10) / 10,
    }));
    return NextResponse.json(
      {
        freePullsLeft: 1,
        nextFreeAt: getNextMidnightJST(),
        isSubscriber: false,
        rateMultiplier: 1,
        items,
        equipment,
        paidGachaPity: 0,
      },
      { status: 200 }
    );
  }
}
