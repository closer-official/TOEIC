import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// 認証コールバックは必ず実行時リクエストの URL でリダイレクトする必要がある。
// force-static にするとビルド時の request.url（localhost）が使われ、本番で localhost に飛ぶ不具合の原因になる。
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** 同一オリジンまたは相対パス以外の next を無効化し、localhost 等へのリダイレクトを防ぐ */
function safeNext(next: string | null, requestUrl: string): string {
  const fallback = '/';
  const raw = next?.trim() ?? fallback;
  if (!raw || raw === '') return fallback;
  try {
    const base = new URL(requestUrl);
    // 相対パス（/ 始まりで // でない）
    if (raw.startsWith('/') && !raw.startsWith('//')) {
      const path = raw.split('?')[0];
      if (path.includes('//')) return fallback;
      return raw;
    }
    const target = new URL(raw, base);
    if (target.origin !== base.origin) return fallback;
    return target.pathname + target.search;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'), request.url);

  if (!code) {
    return NextResponse.redirect(new URL('/', request.url));
  }

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
          // setAll が Server Component から呼ばれた場合は無視
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
