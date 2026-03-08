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

/** GET: 参加申請一覧（リーダー・幹部のみ）。status=pending のみ */
export async function GET() {
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
      return NextResponse.json({ error: '参加申請の確認はリーダーまたは幹部のみ可能です' }, { status: 403 });
    }

    const guildId = (membership as { guild_id: string }).guild_id;

    const { data: requests, error: listErr } = await supabase
      .from('guild_join_requests')
      .select('id, user_id, status, created_at')
      .eq('guild_id', guildId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const list = requests ?? [];
    const userIds = [...new Set(list.map((r: { user_id: string }) => r.user_id))];
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
    const withUsername = list.map((r: { id: string; user_id: string; status: string; created_at: string }) => ({
      ...r,
      username: usernames[r.user_id] ?? `ID:${r.user_id.slice(0, 8)}`,
    }));

    return NextResponse.json({ requests: withUsername });
  } catch (err) {
    console.error('[guild join-requests] GET error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** POST: 参加申請を承認または却下。body: { requestId, action: 'approve' | 'reject' }。リーダー・幹部のみ */
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
      return NextResponse.json({ error: '承認・却下はリーダーまたは幹部のみ可能です' }, { status: 403 });
    }

    const guildId = (membership as { guild_id: string }).guild_id;
    const body = await req.json().catch(() => ({}));
    const requestId = body?.requestId ?? body?.request_id;
    const action = body?.action === 'reject' ? 'reject' : body?.action === 'approve' ? 'approve' : null;

    if (!requestId || !action) {
      return NextResponse.json({ error: 'requestId と action (approve / reject) を指定してください' }, { status: 400 });
    }

    const { data: joinRequest, error: fetchErr } = await supabase
      .from('guild_join_requests')
      .select('id, guild_id, user_id, status')
      .eq('id', requestId)
      .single();

    if (fetchErr || !joinRequest) {
      return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 });
    }

    if ((joinRequest as { guild_id: string }).guild_id !== guildId) {
      return NextResponse.json({ error: 'このギルドの申請ではありません' }, { status: 403 });
    }

    if ((joinRequest as { status: string }).status !== 'pending') {
      return NextResponse.json({ error: 'この申請は既に処理済みです' }, { status: 400 });
    }

    const applicantUserId = (joinRequest as { user_id: string }).user_id;

    if (action === 'reject') {
      const { error: upErr } = await supabase
        .from('guild_join_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: '申請を却下しました' });
    }

    const { data: guild } = await supabase
      .from('guilds')
      .select('lab_score_lv')
      .eq('id', guildId)
      .single();

    const labScoreLv = (guild as { lab_score_lv?: number } | null)?.lab_score_lv ?? 0;
    const { count } = await supabase
      .from('guild_members')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);

    if ((count ?? 0) >= maxGuildMembers(labScoreLv)) {
      return NextResponse.json({ error: '定員に達しているため承認できません' }, { status: 400 });
    }

    const { error: insertErr } = await supabase
      .from('guild_members')
      .insert({
        guild_id: guildId,
        user_id: applicantUserId,
        role: 'member',
      });

    if (insertErr) {
      if (insertErr.code === '23505') {
        await supabase
          .from('guild_join_requests')
          .update({ status: 'rejected' })
          .eq('id', requestId);
        return NextResponse.json({ error: '既にメンバーになっています' }, { status: 400 });
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { error: upErr } = await supabase
      .from('guild_join_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: '参加を承認しました' });
  } catch (err) {
    console.error('[guild join-requests] POST error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
