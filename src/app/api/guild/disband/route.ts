import { NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

/** POST: ギルドを解散（リーダーのみ）。作成コストの返金はなし。 */
export async function POST() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

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
