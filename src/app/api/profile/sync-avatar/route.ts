import { NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

/**
 * POST: ログインユーザーの Auth (OAuth) のアバターを profiles.avatar_url に同期する。
 * profile.avatar_url が空のときのみ上書きする（設定で変更した場合は触らない）。
 */
export async function POST() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const supabase = await createApiSupabaseClient();
  const { user, authError } = await getApiUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ ok: false });
  }

  const avatarFromAuth =
    (user.user_metadata?.avatar_url as string)?.trim() ||
    (user.user_metadata?.picture as string)?.trim() ||
    '';

  if (!avatarFromAuth) {
    return NextResponse.json({ ok: true });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('user_id', user.id)
    .maybeSingle();

  const current = (profile as { avatar_url?: string | null } | null)?.avatar_url;
  if (current != null && String(current).trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  await supabase
    .from('profiles')
    .update({
      avatar_url: avatarFromAuth,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  return NextResponse.json({ ok: true });
}
