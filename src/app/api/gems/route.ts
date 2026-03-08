import { NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';

/** GET: 自分のチップ残高 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ gems: 0 }, { status: 200 });
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profErr && /gems|column.*does not exist/i.test(profErr.message)) {
      return NextResponse.json({ gems: 0 }, { status: 200 });
    }
    const gems = Math.max(0, (profile as { gems?: number } | null)?.gems ?? 0);
    return NextResponse.json({ gems });
  } catch {
    return NextResponse.json({ gems: 0 }, { status: 200 });
  }
}
