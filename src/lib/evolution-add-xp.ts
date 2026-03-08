import type { SupabaseClient } from '@supabase/supabase-js';
import { correctTimeMultiplier } from '@/lib/evolution';
import { getGuildXpBoosterMultiplier } from '@/lib/guild-xp-booster';
import { getXpMultiplierForStamina } from '@/lib/stamina';

export type AddEvolutionXpParams = {
  score: number;
  gameMode: string;
  epMult: number;
  staminaAmount: number;
};

/** 1 run 分の XP を加算（evolution POST と offline-sync で共用） */
export async function addEvolutionXp(
  supabase: SupabaseClient,
  userId: string,
  params: AddEvolutionXpParams
): Promise<{ ok: boolean; added?: number }> {
  const { score, gameMode, epMult, staminaAmount } = params;
  const rate = gameMode === 'part5-national' || gameMode === 'part5' ? 0.09 : 0.03;
  const mult = Math.max(0.01, Math.min(10, Number(epMult) || 1));

  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('evolution_points, guild_xp, evolution_correct_time, evolution_season_carry_correct_time')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr) {
    if (/evolution_points|guild_xp|column.*does not exist/i.test(fetchErr.message)) {
      return { ok: true, added: 0 };
    }
    throw new Error(fetchErr.message);
  }

  const p = profile as { evolution_points?: number; evolution_correct_time?: number; evolution_season_carry_correct_time?: number; guild_xp?: number } | null;
  const xpMult = correctTimeMultiplier(p?.evolution_correct_time ?? 0, p?.evolution_season_carry_correct_time ?? 0);
  const staminaXpMult = getXpMultiplierForStamina(Number(staminaAmount) || 5);
  const totalAdded = Math.floor(score * rate * mult * xpMult * staminaXpMult);
  if (totalAdded <= 0) return { ok: true, added: 0 };

  const boosterMult = await getGuildXpBoosterMultiplier(supabase, userId);
  const totalAddedWithBooster = totalAdded * boosterMult;
  const addCommon = Math.floor((totalAddedWithBooster * 2) / 3);
  const addGuild = totalAddedWithBooster - addCommon;

  const currentCommon = p?.evolution_points ?? 0;
  const currentGuild = p?.guild_xp ?? 0;
  const newCommon = currentCommon + addCommon;
  const now = new Date().toISOString();

  const { data: guildMember } = await supabase
    .from('guild_members')
    .select('guild_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (guildMember && addGuild > 0) {
    const guildId = (guildMember as { guild_id: string }).guild_id;
    const { data: guildRow } = await supabase.from('guilds').select('total_donated_xp').eq('id', guildId).single();
    const newTotal = (guildRow as { total_donated_xp?: number } | null)?.total_donated_xp ?? 0;
    await supabase.from('guilds').update({ total_donated_xp: newTotal + addGuild, updated_at: now }).eq('id', guildId);
    const { data: memberRow } = await supabase
      .from('guild_members')
      .select('donated_xp')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();
    const curDonated = (memberRow as { donated_xp?: number } | null)?.donated_xp ?? 0;
    await supabase
      .from('guild_members')
      .update({ donated_xp: curDonated + addGuild })
      .eq('guild_id', guildId)
      .eq('user_id', userId);
  }

  const newGuild = guildMember ? currentGuild : currentGuild + addGuild;

  if (profile == null) {
    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert(
        { user_id: userId, evolution_points: newCommon, guild_xp: newGuild, updated_at: now },
        { onConflict: 'user_id' }
      );
    if (upsertErr) {
      if (/evolution_points|guild_xp|column.*does not exist/i.test(upsertErr.message)) return { ok: true, added: 0 };
      throw new Error(upsertErr.message);
    }
    return { ok: true, added: totalAddedWithBooster };
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ evolution_points: newCommon, guild_xp: newGuild, updated_at: now })
    .eq('user_id', userId);

  if (updateErr) {
    if (/evolution_points|guild_xp|column.*does not exist/i.test(updateErr.message)) return { ok: true, added: 0 };
    throw new Error(updateErr.message);
  }
  return { ok: true, added: totalAddedWithBooster };
}
