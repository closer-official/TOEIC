import { NextRequest, NextResponse } from 'next/server';
import { getGuildXpBoosterMultiplier } from '@/lib/guild-xp-booster';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-dynamic';

/** 全共通XP → ギルドXP 交換レート（1 全共通XP = 1.2 ギルドXP）。逆交換は不可。 */
const COMMON_TO_GUILD_RATE = 1.2;

/** POST: 全共通XPをギルドXPに交換。body: { amount: number }。1.2倍で付与。ギルドXP→全共通XPの交換は不可。 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const amount = Math.floor(Number(body?.amount ?? 0));
    if (amount <= 0) {
      return NextResponse.json({ error: '1以上の整数を指定してください' }, { status: 400 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('evolution_points, guild_xp')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'プロフィールの取得に失敗しました' }, { status: 500 });
    }

    const currentCommon = (profile as { evolution_points?: number }).evolution_points ?? 0;
    const currentGuild = (profile as { guild_xp?: number }).guild_xp ?? 0;

    if (currentCommon < amount) {
      return NextResponse.json({
        error: `全共通XPが足りません（所持: ${currentCommon}、必要: ${amount}）`,
      }, { status: 400 });
    }

    const boosterMult = await getGuildXpBoosterMultiplier(supabase, user.id);
    const guildReceived = Math.floor(amount * COMMON_TO_GUILD_RATE * boosterMult);
    const newCommon = currentCommon - amount;
    const newGuild = currentGuild + guildReceived;
    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        evolution_points: newCommon,
        guild_xp: newGuild,
        updated_at: now,
      })
      .eq('user_id', user.id);

    if (updateErr) {
      if (/guild_xp|column.*does not exist/i.test(updateErr.message)) {
        return NextResponse.json({ error: 'ギルドXP機能はマイグレーション適用後に利用できます' }, { status: 500 });
      }
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      spentCommon: amount,
      receivedGuild: guildReceived,
      newCommon,
      newGuild,
    });
  } catch (err) {
    console.error('[exchange common-to-guild-xp] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
