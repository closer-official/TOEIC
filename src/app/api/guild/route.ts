import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
}

/** GET: 自分のギルド情報、または ?search=1 でギルド一覧（タグ・join_type でフィルタ） */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const tag = searchParams.get('tag');
    const joinType = searchParams.get('join_type');

    if (search === '1') {
      const baseSelect = 'id, name, leader_comment, emblem_url, level, total_donated_xp, join_type, tags, leader_id, created_at';
      let q = supabase
        .from('guilds')
        .select(baseSelect)
        .order('total_donated_xp', { ascending: false })
        .limit(50);
      if (tag) {
        q = q.contains('tags', [tag]);
      }
      if (joinType && (joinType === 'open' || joinType === 'approval' || joinType === 'invite')) {
        q = q.eq('join_type', joinType);
      }
      let list: { id: string; name: string; leader_comment: string | null; emblem_url?: string | null; level: number; total_donated_xp: number; join_type: string; tags: string[]; leader_id: string; created_at: string }[] | null = null;
      let error: { message: string } | null = null;
      const first = await q;
      list = first.data;
      error = first.error;
      if (error && /emblem_url|column.*does not exist/i.test(error.message)) {
        let fallbackQ = supabase
          .from('guilds')
          .select('id, name, leader_comment, level, total_donated_xp, join_type, tags, leader_id, created_at')
          .order('total_donated_xp', { ascending: false })
          .limit(50);
        if (tag) fallbackQ = fallbackQ.contains('tags', [tag]);
        if (joinType && (joinType === 'open' || joinType === 'approval' || joinType === 'invite')) fallbackQ = fallbackQ.eq('join_type', joinType);
        const fallback = await fallbackQ;
        type GuildRow = { id: string; name: string; leader_comment: string | null; emblem_url?: string | null; level: number; total_donated_xp: number; join_type: string; tags: string[]; leader_id: string; created_at: string };
        list = (fallback.data ?? []).map((g) => ({ ...g, emblem_url: null } as GuildRow));
        error = fallback.error;
      }
      if (error) {
        if (/relation.*guilds|does not exist/i.test(error.message)) {
          return NextResponse.json({ guilds: [] });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const { data: memberCounts } = await supabase
        .from('guild_members')
        .select('guild_id');
      const countByGuild = (memberCounts ?? []).reduce((acc: Record<string, number>, row: { guild_id: string }) => {
        acc[row.guild_id] = (acc[row.guild_id] ?? 0) + 1;
        return acc;
      }, {});
      const guilds = (list ?? []).map((g: { id: string; name: string; leader_comment: string | null; emblem_url?: string | null; level: number; total_donated_xp: number; join_type: string; tags: string[]; leader_id: string; created_at: string }) => ({
        ...g,
        memberCount: countByGuild[g.id] ?? 0,
      }));
      return NextResponse.json({ guilds });
    }

    const { data: membership } = await supabase
      .from('guild_members')
      .select('guild_id, role, donated_xp, questions_this_week')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('guild_xp')
        .eq('user_id', user.id)
        .maybeSingle();
      const userGuildXp = Math.max(0, (profile as { guild_xp?: number } | null)?.guild_xp ?? 0);
      return NextResponse.json({ guild: null, membership: null, userGuildXp });
    }

    const guildId = (membership as { guild_id: string }).guild_id;
    const labCols = 'id, name, leader_comment, emblem_url, level, total_donated_xp, join_type, invite_code, tags, leader_id, created_at, lab_stamina_lv, lab_xp_lv, lab_score_lv, guild_season, guild_carry_stamina, guild_carry_xp, guild_carry_score';
    let { data: guild, error } = await supabase
      .from('guilds')
      .select(labCols)
      .eq('id', guildId)
      .single();

    if (error && /lab_stamina_lv|guild_season|invite_code|does not exist/i.test(error.message)) {
      const { data: fallback } = await supabase
        .from('guilds')
        .select('id, name, leader_comment, emblem_url, level, total_donated_xp, join_type, tags, leader_id, created_at')
        .eq('id', guildId)
        .single();
      if (fallback) {
        guild = { ...fallback, invite_code: null, lab_stamina_lv: 0, lab_xp_lv: 0, lab_score_lv: 0, guild_season: null, guild_carry_stamina: 0, guild_carry_xp: 0, guild_carry_score: 0 };
        error = null;
      }
    }

    if (error || !guild) {
      return NextResponse.json({ guild: null, membership: null });
    }

    const { data: members } = await supabase
      .from('guild_members')
      .select('user_id, role, donated_xp, questions_this_week, joined_at')
      .eq('guild_id', guild.id);

    const memberList = members ?? [];
    const userIds = [...new Set(memberList.map((m: { user_id: string }) => m.user_id))];
    let usernames: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', userIds);
      for (const p of profiles ?? []) {
        const row = p as { user_id: string; username: string | null };
        usernames[row.user_id] = (row.username?.trim() || `ID:${row.user_id.slice(0, 8)}`);
      }
    }
    const membersWithUsername = memberList.map((m: { user_id: string; role: string; donated_xp: number; questions_this_week: number; joined_at: string }) => ({
      ...m,
      username: usernames[m.user_id] ?? `ID:${m.user_id.slice(0, 8)}`,
    }));

    const role = (membership as { role: string }).role;
    const guildOut = { ...guild, memberCount: memberList.length };
    if (role !== 'leader' && guildOut.invite_code != null) {
      delete (guildOut as Record<string, unknown>).invite_code;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('guild_xp')
      .eq('user_id', user.id)
      .maybeSingle();
    const userGuildXp = Math.max(0, (profile as { guild_xp?: number } | null)?.guild_xp ?? 0);

    return NextResponse.json({
      guild: guildOut,
      membership,
      members: membersWithUsername,
      userGuildXp,
    });
  } catch (err) {
    console.error('[guild] GET error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** ギルド設立に必要なギルドXP */
const GUILD_CREATE_XP_COST = 30_000;

/** POST: ギルド作成（30,000 ギルドXP 消費） body: { name, leaderComment?, joinType?, tags? } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { data: existing } = await supabase
      .from('guild_members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '既にギルドに参加しています。脱退してから作成してください。' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('guild_xp')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentGuildXp = Math.max(0, (profile as { guild_xp?: number } | null)?.guild_xp ?? 0);
    if (currentGuildXp < GUILD_CREATE_XP_COST) {
      return NextResponse.json(
        { error: `ギルドXPが足りません。ギルド設立には${GUILD_CREATE_XP_COST.toLocaleString()} ギルドXP 必要です。（所持: ${currentGuildXp.toLocaleString()}）` },
        { status: 402 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim().slice(0, 20);
    if (!name) {
      return NextResponse.json({ error: 'ギルド名を入力してください（20文字以内）' }, { status: 400 });
    }

    const leaderComment = String(body?.leaderComment ?? '').trim().slice(0, 100);
    const joinTypeRaw = body?.joinType;
    const joinType = joinTypeRaw === 'invite' ? 'invite' : joinTypeRaw === 'approval' ? 'approval' : 'open';
    const tags = Array.isArray(body?.tags) ? body.tags.slice(0, 5).map((t: unknown) => String(t).trim()).filter(Boolean) : [];
    const now = new Date().toISOString();
    const inviteCode = joinType === 'invite' ? `inv-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}` : null;

    const { data: guild, error: insertErr } = await supabase
      .from('guilds')
      .insert({
        name,
        leader_comment: leaderComment || null,
        level: 1,
        total_donated_xp: 0,
        join_type: joinType,
        invite_code: inviteCode,
        tags,
        leader_id: user.id,
        updated_at: now,
      })
      .select('id, name, leader_comment, level, join_type, tags')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { error: memberErr } = await supabase.from('guild_members').insert({
      guild_id: guild.id,
      user_id: user.id,
      role: 'leader',
    });

    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }

    await supabase
      .from('profiles')
      .update({ guild_xp: currentGuildXp - GUILD_CREATE_XP_COST, updated_at: now })
      .eq('user_id', user.id);

    return NextResponse.json({ ok: true, guild });
  } catch (err) {
    console.error('[guild] POST error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** PATCH: ギルド設定を更新（リーダーのみ）。body: { name?, leaderComment?, joinType?, emblem_url? } */
export async function PATCH(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('guild_members')
      .select('guild_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || (membership as { role: string }).role !== 'leader') {
      return NextResponse.json({ error: 'ギルドリーダーのみ変更できます' }, { status: 403 });
    }

    const guildId = (membership as { guild_id: string }).guild_id;
    const body = await req.json().catch(() => ({}));
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const name = body?.name;
    if (name !== undefined) {
      const v = String(name).trim().slice(0, 20);
      if (!v) {
        return NextResponse.json({ error: 'ギルド名は1文字以上20文字以内で入力してください' }, { status: 400 });
      }
      update.name = v;
    }
    const leaderComment = body?.leaderComment;
    if (leaderComment !== undefined) {
      update.leader_comment = String(leaderComment).trim().slice(0, 100) || null;
    }
    const joinTypeRaw = body?.joinType;
    if (joinTypeRaw !== undefined) {
      const jt = joinTypeRaw === 'invite' ? 'invite' : joinTypeRaw === 'approval' ? 'approval' : 'open';
      update.join_type = jt;
      if (jt === 'invite') {
        const { data: g } = await supabase.from('guilds').select('invite_code').eq('id', guildId).single();
        if (g && !(g as { invite_code?: string | null }).invite_code) {
          (update as Record<string, unknown>).invite_code = `inv-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
        }
      }
    }
    const emblemUrl = body?.emblem_url;
    if (emblemUrl !== undefined) {
      const v = typeof emblemUrl === 'string' ? emblemUrl.trim().slice(0, 2048) : '';
      update.emblem_url = v || null;
    }

    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from('guilds')
      .update(update)
      .eq('id', guildId)
      .eq('leader_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[guild] PATCH error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
