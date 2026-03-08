import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const ALLOWED_CORS_ORIGINS = new Set([
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
]);

function applyCors(response: NextResponse, origin: string | null) {
  if (!origin || !ALLOWED_CORS_ORIGINS.has(origin)) return;
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Client-Info, ApiKey');
  response.headers.set('Access-Control-Max-Age', '86400');
}

export async function middleware(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith('/api/');
  const origin = request.headers.get('origin');
  if (isApi && request.method === 'OPTIONS') {
    const preflight = new NextResponse(null, { status: 204 });
    applyCors(preflight, origin);
    return preflight;
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isApi) applyCors(response, origin);
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  if (isApi) applyCors(response, origin);
  return response;
}
