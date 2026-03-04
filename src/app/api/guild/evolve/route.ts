import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type GuildLabBranch = 'stamina' | 'xp' | 'score';

/** ギルド研究室 Lv0→1 の必要XP（初動を早めるため15万系に調整）。Lvごとに2倍 */
const GUILD_LAB_COST_INITIAL: Record<GuildLabBranch, number> = {
  xp: 150_000,
  score: 250_000,
  stamina: 350_000,
};

const GUILD_LAB_COLUMNS: Record<GuildLabBranch, string> = {
  stamina: 'lab_stamina_lv',
  xp: 'lab_xp_lv',
  score: 'lab_score_lv',
};

/** POST: ギルド研究室を1段階上げる。body: { branch: 'stamina'|'xp'|'score' }。リーダー・幹部のみ。total_donated_xp を消費。シーズンリセットなし。 */
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

    const body = await req.json().catch(() => ({}));
    const branch = (body?.branch === 'stamina' || body?.branch === 'xp' || body?.branch === 'score') ? body.branch as GuildLabBranch : null;
    if (!branch) {
      return NextResponse.json({ error: 'branch は stamina / xp / score のいずれかを指定してください' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('guild_members')
      .select('guild_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'ギルドに参加していません' }, { status: 400 });
    }

    const role = (membership as { role: string }).role;
    if (role !== 'leader' && role !== 'officer') {
      return NextResponse.json({ error: 'リーダーまたは幹部のみ研究室を強化できます' }, { status: 403 });
    }

    const guildId = (membership as { guild_id: string }).guild_id;
    const cols = 'total_donated_xp, lab_stamina_lv, lab_xp_lv, lab_score_lv';
    const { data: guild, error: guildErr } = await supabase
      .from('guilds')
      .select(cols)
      .eq('id', guildId)
      .single();

    if (guildErr || !guild) {
      return NextResponse.json({ error: guildErr?.message ?? 'ギルドを取得できません' }, { status: 500 });
    }

    const g = guild as { total_donated_xp?: number; lab_stamina_lv?: number; lab_xp_lv?: number; lab_score_lv?: number };
    const currentLevel = branch === 'stamina' ? (g.lab_stamina_lv ?? 0) : branch === 'xp' ? (g.lab_xp_lv ?? 0) : (g.lab_score_lv ?? 0);
    if (currentLevel >= 10) {
      return NextResponse.json({ error: 'この分岐はすでにLv.10です' }, { status: 400 });
    }

    const cost = GUILD_LAB_COST_INITIAL[branch] * Math.pow(2, currentLevel);
    const totalXp = Math.max(0, g.total_donated_xp ?? 0);
    if (totalXp < cost) {
      return NextResponse.json({ error: `ギルドXPが足りません（必要: ${cost.toLocaleString()}、所持: ${totalXp.toLocaleString()}）` }, { status: 400 });
    }

    const col = GUILD_LAB_COLUMNS[branch];
    const { data: updated, error: updateErr } = await supabase
      .from('guilds')
      .update({
        [col]: currentLevel + 1,
        total_donated_xp: totalXp - cost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', guildId)
      .select(col)
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const newLevel = (updated as unknown as Record<string, number>)[col] ?? currentLevel + 1;
    return NextResponse.json({ ok: true, level: newLevel, cost });
  } catch (err) {
    console.error('[guild evolve] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
