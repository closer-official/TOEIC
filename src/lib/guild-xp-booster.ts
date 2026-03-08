import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * ギルドのXPブースター、またはユーザー個人のXPブースターが有効なら 2、そうでなければ 1。
 * ギルド未所属でも個人で使用したブースターがあれば 2 を返す。
 */
export async function getGuildXpBoosterMultiplier(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: member } = await supabase
    .from('guild_members')
    .select('guild_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (member?.guild_id) {
    const { data: guild } = await supabase
      .from('guilds')
      .select('xp_booster_ends_at')
      .eq('id', (member as { guild_id: string }).guild_id)
      .maybeSingle();
    const guildEndsAt = (guild as { xp_booster_ends_at?: string | null } | null)?.xp_booster_ends_at;
    if (guildEndsAt && new Date(guildEndsAt) > new Date()) return 2;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp_booster_ends_at')
    .eq('user_id', userId)
    .maybeSingle();
  const profileEndsAt = (profile as { xp_booster_ends_at?: string | null } | null)?.xp_booster_ends_at;
  if (profileEndsAt && new Date(profileEndsAt) > new Date()) return 2;
  return 1;
}
