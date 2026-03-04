import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** ギルド最大人数: 10 + lab_score_lv * 2（上限なし） */
function maxGuildMembers(labScoreLv: number): number {
  return 10 + (labScoreLv || 0) * 2;
}

/** POST: ギルドに参加 body: { guildId } または { inviteCode }。open は即参加、approval は申請、invite は招待コード必須 */
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
    const inviteCodeRaw = body?.inviteCode ?? body?.invite_code;
    let guildId = body?.guildId ?? body?.guild_id;

    let guild: { id: string; join_type: string; lab_score_lv?: number } | null = null;

    if (inviteCodeRaw && String(inviteCodeRaw).trim()) {
      const code = String(inviteCodeRaw).trim();
      const { data: g, error: codeErr } = await supabase
        .from('guilds')
        .select('id, join_type, lab_score_lv')
        .eq('invite_code', code)
        .maybeSingle();
      if (codeErr || !g) {
        return NextResponse.json({ error: '招待コードが無効か期限切れです' }, { status: 404 });
      }
      guild = g as { id: string; join_type: string; lab_score_lv?: number };
      guildId = guild.id;
    }

    if (!guild && guildId) {
      const { data: g, error: guildErr } = await supabase
        .from('guilds')
        .select('id, join_type, lab_score_lv')
        .eq('id', guildId)
        .single();
      if (guildErr || !g) {
        return NextResponse.json({ error: 'ギルドが見つかりません' }, { status: 404 });
      }
      guild = g as { id: string; join_type: string; lab_score_lv?: number };
    }

    if (!guild || !guildId) {
      return NextResponse.json({ error: 'guildId または inviteCode を指定してください' }, { status: 400 });
    }

    const joinType = guild.join_type;
    if (joinType === 'invite' && !inviteCodeRaw) {
      return NextResponse.json({ error: '招待制のギルドには招待コードが必要です' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('guild_members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: '既に他のギルドに参加しています' }, { status: 400 });
    }

    if (joinType === 'approval') {
      const { count } = await supabase
        .from('guild_members')
        .select('*', { count: 'exact', head: true })
        .eq('guild_id', guildId);
      const maxMembers = maxGuildMembers(guild.lab_score_lv ?? 0);
      if ((count ?? 0) >= maxMembers) {
        return NextResponse.json({ error: 'このギルドは定員に達しています' }, { status: 400 });
      }
      const { error: reqErr } = await supabase.from('guild_join_requests').insert({
        guild_id: guildId,
        user_id: user.id,
        status: 'pending',
      });
      if (reqErr) {
        if (reqErr.code === '23505') {
          return NextResponse.json({ error: '既に申請済みです' }, { status: 400 });
        }
        return NextResponse.json({ error: reqErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, pending: true, message: '参加申請を送りました。リーダーの承認をお待ちください。' });
    }

    const { count } = await supabase
      .from('guild_members')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    const maxMembers = maxGuildMembers(guild.lab_score_lv ?? 0);
    if ((count ?? 0) >= maxMembers) {
      return NextResponse.json({ error: 'このギルドは定員に達しています' }, { status: 400 });
    }

    const { error: insertErr } = await supabase.from('guild_members').insert({
      guild_id: guildId,
      user_id: user.id,
      role: 'member',
    });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: '既に参加しています' }, { status: 400 });
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[guild join] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
