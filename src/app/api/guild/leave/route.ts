import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

/** POST: ギルドから脱退。リーダーは脱退時にギルド削除またはリーダー譲渡が必要（現状は脱退のみ） */
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
      .select('id, guild_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'ギルドに参加していません' }, { status: 400 });
    }

    const role = (membership as { role: string }).role;
    const guildId = (membership as { guild_id: string }).guild_id;

    if (role === 'leader') {
      const { data: others } = await supabase
        .from('guild_members')
        .select('id')
        .eq('guild_id', guildId)
        .neq('user_id', user.id);
      if ((others ?? []).length > 0) {
        return NextResponse.json({ error: 'リーダーはメンバーがいる間は脱退できません。リーダーを譲渡するか、メンバーが0人になってから脱退してください。' }, { status: 400 });
      }
      await supabase.from('guilds').delete().eq('id', guildId);
    }

    const { error: delErr } = await supabase
      .from('guild_members')
      .delete()
      .eq('user_id', user.id)
      .eq('guild_id', guildId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[guild leave] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
