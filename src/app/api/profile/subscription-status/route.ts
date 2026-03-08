import { NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


/** GET: ログイン中のユーザーの profiles の is_subscriber, subscription_tier, gems を返す（デバッグ・確認用） */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

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
