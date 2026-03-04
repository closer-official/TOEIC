import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const OFFICER_MAX = 3;

/** POST: 幹部の任命・解任（リーダーのみ）。body: { userId, action: 'appoint' | 'dismiss' } */
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

    const { data: myMembership } = await supabase
      .from('guild_members')
      .select('guild_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!myMembership || (myMembership as { role: string }).role !== 'leader') {
      return NextResponse.json({ error: '幹部の任命・解任はリーダーのみ可能です' }, { status: 403 });
    }

    const guildId = (myMembership as { guild_id: string }).guild_id;
    const body = await req.json().catch(() => ({}));
    const targetUserId = body?.userId ?? body?.user_id;
    const action = body?.action === 'dismiss' ? 'dismiss' : body?.action === 'appoint' ? 'appoint' : null;

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'userId と action (appoint / dismiss) を指定してください' }, { status: 400 });
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: '自分自身の役職は変更できません' }, { status: 400 });
    }

    const { data: targetMember } = await supabase
      .from('guild_members')
      .select('id, role')
      .eq('guild_id', guildId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json({ error: '対象がこのギルドのメンバーではありません' }, { status: 404 });
    }

    const targetRole = (targetMember as { role: string }).role;
    if (targetRole === 'leader') {
      return NextResponse.json({ error: 'リーダーの役職は変更できません' }, { status: 400 });
    }

    if (action === 'appoint') {
      if (targetRole === 'officer') {
        return NextResponse.json({ ok: true, message: '既に幹部です' });
      }
      const { count } = await supabase
        .from('guild_members')
        .select('*', { count: 'exact', head: true })
        .eq('guild_id', guildId)
        .eq('role', 'officer');
      if ((count ?? 0) >= OFFICER_MAX) {
        return NextResponse.json({ error: `幹部は最大${OFFICER_MAX}人までです` }, { status: 400 });
      }
      const { error: upErr } = await supabase
        .from('guild_members')
        .update({ role: 'officer' })
        .eq('guild_id', guildId)
        .eq('user_id', targetUserId);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: '幹部に任命しました' });
    }

    if (targetRole !== 'officer') {
      return NextResponse.json({ ok: true, message: '対象は幹部ではありません' });
    }
    const { error: upErr } = await supabase
      .from('guild_members')
      .update({ role: 'member' })
      .eq('guild_id', guildId)
      .eq('user_id', targetUserId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, message: '幹部を解任しました' });
  } catch (err) {
    console.error('[guild officer] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
