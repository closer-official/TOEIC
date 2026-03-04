import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** GET: 自分のジェム残高 */
export async function GET() {
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
