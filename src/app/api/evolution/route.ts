import { NextRequest, NextResponse } from 'next/server';
import { costForNextLevel, correctTimeMultiplier, SEASON_BRANCHES, type EvolutionBranch } from '@/lib/evolution';
import { getGuildXpBoosterMultiplier } from '@/lib/guild-xp-booster';
import { getXpMultiplierForStamina } from '@/lib/stamina';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-dynamic';

type Branch = EvolutionBranch;
const BRANCH_COLUMNS: Record<Branch, string> = {
  correct_time: 'evolution_correct_time',
  score: 'evolution_score',
  wrong_penalty: 'evolution_wrong_penalty',
};

const DEFAULT_EVOLUTION = {
  points: 0,
  branches: { correct_time: 0, score: 0, wrong_penalty: 0 },
  seasonCarry: { correct_time: 0, score: 0, wrong_penalty: 0 },
  currentSeason: '',
  seasonEnd: '',
};

/** 日本標準時で今月のシーズン文字列 YYYY-MM */
function getCurrentSeasonJST(): string {
  const jst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** 今月の最終日 23:59:59 JST の ISO 文字列 */
function getSeasonEndJST(): string {
  const now = Date.now();
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now + jstOffsetMs);
  const y = jstNow.getUTCFullYear();
  const m = jstNow.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(y, m, lastDay, 14, 59, 59, 999)); // 23:59:59 JST = 14:59:59 UTC
  return end.toISOString();
}

/** GET: 進化状態。シーズンは月次で自動リセット。Lv.10到達分は翌シーズン1.1倍スタート */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const currentSeason = getCurrentSeasonJST();
    const seasonEnd = getSeasonEndJST();

    const selectCols = 'evolution_points, evolution_correct_time, evolution_score, evolution_wrong_penalty, evolution_season, evolution_season_carry_correct_time, evolution_season_carry_score, evolution_season_carry_wrong_penalty';
    let { data: profile, error } = await supabase
      .from('profiles')
      .select(selectCols)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && /evolution_season|evolution_season_carry|does not exist/i.test(error.message)) {
      const baseCols = 'evolution_points, evolution_correct_time, evolution_score, evolution_wrong_penalty';
      const fallback = await supabase
        .from('profiles')
        .select(baseCols)
        .eq('user_id', user.id)
        .maybeSingle();
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      }
      const pf = (fallback.data ?? {}) as { evolution_points?: number; evolution_correct_time?: number; evolution_score?: number; evolution_wrong_penalty?: number };
      return NextResponse.json({
        points: pf.evolution_points ?? 0,
        branches: {
          correct_time: pf.evolution_correct_time ?? 0,
          score: pf.evolution_score ?? 0,
          wrong_penalty: pf.evolution_wrong_penalty ?? 0,
        },
        seasonCarry: { correct_time: 0, score: 0, wrong_penalty: 0 },
        currentSeason,
        seasonEnd,
      });
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type ProfileRow = {
      evolution_points?: number;
      evolution_correct_time?: number;
      evolution_score?: number;
      evolution_wrong_penalty?: number;
      evolution_season?: string | null;
      evolution_season_carry_correct_time?: number;
      evolution_season_carry_score?: number;
      evolution_season_carry_wrong_penalty?: number;
    };
    const p = (profile ?? {}) as ProfileRow;

    let correctTime = p.evolution_correct_time ?? 0;
    let scoreLevel = p.evolution_score ?? 0;
    let wrongPenalty = p.evolution_wrong_penalty ?? 0;
    let carryCorrect = p.evolution_season_carry_correct_time ?? 0;
    let carryScore = p.evolution_season_carry_score ?? 0;
    let carryWrong = p.evolution_season_carry_wrong_penalty ?? 0;
    const storedSeason = p.evolution_season ?? null;

    if (storedSeason !== currentSeason) {
      const newCarryCorrect = correctTime >= 10 ? 0.01 : 0;
      const newCarryScore = scoreLevel >= 10 ? 0.01 : 0;
      const newCarryWrong = wrongPenalty >= 10 ? 0.01 : 0;
      correctTime = 0;
      scoreLevel = 0;
      wrongPenalty = 0;
      carryCorrect = newCarryCorrect;
      carryScore = newCarryScore;
      carryWrong = newCarryWrong;
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          evolution_season: currentSeason,
          evolution_correct_time: 0,
          evolution_score: 0,
          evolution_wrong_penalty: 0,
          evolution_season_carry_correct_time: carryCorrect,
          evolution_season_carry_score: carryScore,
          evolution_season_carry_wrong_penalty: carryWrong,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      if (updateErr) {
        console.warn('[evolution] season rollover update', updateErr.message);
      }
    }

    const points = p.evolution_points ?? 0;

    let guildScoreBonus = 0;
    try {
      const { data: member } = await supabase
        .from('guild_members')
        .select('guild_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (member) {
        const { data: guild, error: guildErr } = await supabase
          .from('guilds')
          .select('lab_score_lv')
          .eq('id', (member as { guild_id: string }).guild_id)
          .maybeSingle();
        if (!guildErr && guild) {
          const g = guild as { lab_score_lv?: number };
          guildScoreBonus = 0.01 * (g.lab_score_lv ?? 0);
        }
      }
    } catch {
      // ギルド研究室カラム未導入時は無視
    }

    return NextResponse.json({
      points,
      branches: {
        correct_time: correctTime,
        score: scoreLevel,
        wrong_penalty: wrongPenalty,
      },
      seasonCarry: {
        correct_time: Number(carryCorrect),
        score: Number(carryScore),
        wrong_penalty: Number(carryWrong),
      },
      currentSeason,
      seasonEnd,
      guildScoreBonus,
    });
  } catch (err) {
    console.error('[evolution] GET error:', err);
    return NextResponse.json(DEFAULT_EVOLUTION);
  }
}

/** POST: ポイント加算（全国モード終了時）body: { score } → points += score * 0.01 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { score, action, mode: gameMode, epMult, staminaAmount } = body as { score?: number; action?: string; branch?: Branch; mode?: string; epMult?: number; staminaAmount?: number };

    if (action === 'upgrade') {
      const { branch } = body as { branch?: Branch };
      if (!branch || !BRANCH_COLUMNS[branch]) {
        return NextResponse.json({ error: '無効な分岐' }, { status: 400 });
      }
      const col = BRANCH_COLUMNS[branch];
      const baseCols = 'evolution_points, evolution_correct_time, evolution_score, evolution_wrong_penalty';
      const { data: profileData, error: fetchErr } = await supabase
        .from('profiles')
        .select(baseCols)
        .eq('user_id', user.id)
        .maybeSingle();
      const profile = profileData;

      if (fetchErr || !profile) {
        return NextResponse.json({ error: fetchErr?.message ?? 'プロフィールなし' }, { status: 500 });
      }

      const p = profile as { evolution_points: number; evolution_correct_time: number; evolution_score: number; evolution_wrong_penalty: number };
      const currentLevel = p[col as keyof typeof p] ?? 0;
      const isSeasonBranch = (SEASON_BRANCHES as readonly string[]).includes(branch);
      const maxLevel = isSeasonBranch ? 10 : 9;
      if (currentLevel >= maxLevel) {
        return NextResponse.json({ error: '最大段階です' }, { status: 400 });
      }

      const cost = costForNextLevel(currentLevel, branch);
      if (p.evolution_points < cost) {
        return NextResponse.json({ error: `ポイントが足りません（必要: ${cost}pt）` }, { status: 400 });
      }

      const newPoints = p.evolution_points - cost;
      const newLevel = currentLevel + 1;
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          evolution_points: newPoints,
          [col]: newLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        points: newPoints,
        branch,
        level: newLevel,
      });
    }

    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json({ error: 'score が必要です' }, { status: 400 });
    }

    /** 単語: score*0.03、パート5: score*0.09。epMult は装備のEP%ボーナス。研鑽の極意で獲得XP倍率を適用。獲得XPを 2:1 で全共通XP と ギルドXP に分配 */
    const rate = gameMode === 'part5-national' ? 0.09 : 0.03;
    const mult = Math.max(0.01, Math.min(10, Number(epMult) || 1));

    const { data: profile, error: fetchErr } = await supabase
      .from('profiles')
      .select('evolution_points, guild_xp, evolution_correct_time, evolution_season_carry_correct_time')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr) {
      if (/evolution_points|guild_xp|column.*does not exist/i.test(fetchErr.message)) {
        console.warn('[evolution] evolution_points/guild_xp column missing, run migration');
        return NextResponse.json({ ok: true, added: 0, points: 0 });
      }
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const p = profile as { evolution_points?: number; evolution_correct_time?: number; evolution_season_carry_correct_time?: number } | null;
    const xpMult = correctTimeMultiplier(p?.evolution_correct_time ?? 0, p?.evolution_season_carry_correct_time ?? 0);
    const staminaXpMult = getXpMultiplierForStamina(Number(staminaAmount) || 5);
    const totalAdded = Math.floor(score * rate * mult * xpMult * staminaXpMult);
    if (totalAdded <= 0) {
      return NextResponse.json({ ok: true, added: 0, addedCommon: 0, addedGuild: 0 });
    }
    const boosterMult = await getGuildXpBoosterMultiplier(supabase, user.id);
    const totalAddedWithBooster = totalAdded * boosterMult;
    const addCommon = Math.floor((totalAddedWithBooster * 2) / 3);
    const addGuild = totalAddedWithBooster - addCommon;

    const currentCommon = (profile as { evolution_points?: number } | null)?.evolution_points ?? 0;
    const currentGuild = (profile as { guild_xp?: number } | null)?.guild_xp ?? 0;
    const newCommon = currentCommon + addCommon;
    const now = new Date().toISOString();

    const { data: guildMember } = await supabase
      .from('guild_members')
      .select('guild_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (guildMember && addGuild > 0) {
      const guildId = (guildMember as { guild_id: string }).guild_id;
      const { data: guildRow } = await supabase.from('guilds').select('total_donated_xp').eq('id', guildId).single();
      const newTotal = (guildRow as { total_donated_xp?: number } | null)?.total_donated_xp ?? 0;
      await supabase
        .from('guilds')
        .update({ total_donated_xp: newTotal + addGuild, updated_at: now })
        .eq('id', guildId);
      const { data: memberRow } = await supabase
        .from('guild_members')
        .select('donated_xp')
        .eq('guild_id', guildId)
        .eq('user_id', user.id)
        .single();
      const curDonated = (memberRow as { donated_xp?: number } | null)?.donated_xp ?? 0;
      await supabase
        .from('guild_members')
        .update({ donated_xp: curDonated + addGuild })
        .eq('guild_id', guildId)
        .eq('user_id', user.id);
    }

    // プレイで獲得したギルドXPは所属の有無にかかわらず所持ギルドXPに加算（研究室・寄付表示は上で更新済み）
    const newGuild = currentGuild + addGuild;

    if (profile == null) {
      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert(
          { user_id: user.id, evolution_points: newCommon, guild_xp: newGuild, updated_at: now },
          { onConflict: 'user_id' }
        );
      if (upsertErr) {
        if (/evolution_points|guild_xp|column.*does not exist/i.test(upsertErr.message)) {
          return NextResponse.json({ ok: true, added: 0, points: 0 });
        }
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, added: totalAddedWithBooster, addedCommon: addCommon, addedGuild: addGuild, points: newCommon });
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        evolution_points: newCommon,
        guild_xp: newGuild,
        updated_at: now,
      })
      .eq('user_id', user.id);

    if (updateErr) {
      if (/evolution_points|guild_xp|column.*does not exist/i.test(updateErr.message)) {
        console.warn('[evolution] evolution_points/guild_xp column missing, run migration');
        return NextResponse.json({ ok: true, added: 0, points: 0 });
      }
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, added: totalAddedWithBooster, addedCommon: addCommon, addedGuild: addGuild, points: newCommon });
  } catch (err) {
    console.error('[evolution] POST error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
