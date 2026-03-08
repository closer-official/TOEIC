import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

const MAX_MESSAGE_LENGTH = 500;
const LIST_LIMIT = 100;

/** GET: ギルドチャットの直近メッセージ一覧。所属メンバーのみ。 */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('guild_members')
      .select('guild_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'ギルドに参加していません' }, { status: 400 });
    }

    const guildId = (membership as { guild_id: string }).guild_id;

    const { data: rows, error: listErr } = await supabase
      .from('guild_chat_messages')
      .select('id, user_id, body, created_at')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);

    if (listErr) {
      if (/relation.*guild_chat_messages|does not exist/i.test(listErr.message)) {
        return NextResponse.json({ messages: [] });
      }
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    const messages = (rows ?? []).reverse();
    const userIds = [...new Set(messages.map((m: { user_id: string }) => m.user_id))];

    let usernames: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', userIds);
      for (const p of profiles ?? []) {
        const row = p as { user_id: string; username: string | null };
        usernames[row.user_id] = row.username?.trim() || `ID:${row.user_id.slice(0, 8)}`;
      }
    }

    const list = messages.map((m: { id: string; user_id: string; body: string; created_at: string }) => ({
      id: m.id,
      user_id: m.user_id,
      username: usernames[m.user_id] ?? `ID:${m.user_id.slice(0, 8)}`,
      body: m.body,
      created_at: m.created_at,
    }));

    return NextResponse.json({ messages: list });
  } catch (err) {
    console.error('[guild chat] GET error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** POST: ギルドチャットに投稿。body: { body: string }。500文字以内。 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('guild_members')
      .select('guild_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'ギルドに参加していません' }, { status: 400 });
    }

    const guildId = (membership as { guild_id: string }).guild_id;
    const body = await req.json().catch(() => ({}));
    const text = String(body?.body ?? '').trim().slice(0, MAX_MESSAGE_LENGTH);

    if (!text) {
      return NextResponse.json({ error: 'メッセージを1文字以上500文字以内で入力してください' }, { status: 400 });
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('guild_chat_messages')
      .insert({
        guild_id: guildId,
        user_id: user.id,
        body: text,
      })
      .select('id, user_id, body, created_at')
      .single();

    if (insertErr) {
      if (/relation.*guild_chat_messages|does not exist/i.test(insertErr.message)) {
        return NextResponse.json({ error: 'チャット機能は準備中です' }, { status: 503 });
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const m = inserted as { id: string; user_id: string; body: string; created_at: string };
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', user.id)
      .maybeSingle();
    const username = (profile as { username?: string | null } | null)?.username?.trim() || `ID:${user.id.slice(0, 8)}`;

    return NextResponse.json({
      message: {
        id: m.id,
        user_id: m.user_id,
        username,
        body: m.body,
        created_at: m.created_at,
      },
    });
  } catch (err) {
    console.error('[guild chat] POST error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
