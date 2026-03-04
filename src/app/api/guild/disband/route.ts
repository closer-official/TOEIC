import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** POST: ギルドを解散（リーダーのみ）。作成コストの返金はなし。 */
export async function POST() {
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

    if (!membership || (membership as { role: string }).role !== 'leader') {
      return NextResponse.json({ error: 'ギルドリーダーのみ解散できます' }, { status: 403 });
    }

    const guildId = (membership as { guild_id: string }).guild_id;

    const { error: delErr } = await supabase
      .from('guilds')
      .delete()
      .eq('id', guildId)
      .eq('leader_id', user.id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'ギルドを解散しました' });
  } catch (err) {
    console.error('[guild disband] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
