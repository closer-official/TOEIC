import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * POST: ログインユーザーの Auth (OAuth) のアバターを profiles.avatar_url に同期する。
 * profile.avatar_url が空のときのみ上書きする（設定で変更した場合は触らない）。
 */
export async function POST() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
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
