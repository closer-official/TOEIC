import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** GET: ログイン中のユーザーの profiles の is_subscriber, subscription_tier, gems を返す（デバッグ・確認用） */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_id, is_subscriber, subscription_tier, gems')
      .eq('user_id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      user_id: profile?.user_id,
      is_subscriber: profile?.is_subscriber ?? false,
      subscription_tier: profile?.subscription_tier ?? null,
      gems: profile?.gems ?? 0,
    });
  } catch (e) {
    console.error('[subscription-status]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
