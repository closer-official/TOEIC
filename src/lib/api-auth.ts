import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token.length > 0 ? token : null;
}

/** API Route 用: cookie 認証 + Authorization ヘッダー認証の両対応 Supabase クライアント */
export async function createApiSupabaseClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization') ?? '';
  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
    ...(authHeader ? { global: { headers: { Authorization: authHeader } } } : {}),
  });
}

/** API Route 用: cookie 不達時は Authorization: Bearer <token> でユーザーを復元 */
export async function getApiUser(
  supabase: Awaited<ReturnType<typeof createApiSupabaseClient>>
): Promise<{ user: User | null; authError: unknown }> {
  const first = await supabase.auth.getUser();
  if (first.data.user) {
    return { user: first.data.user, authError: null };
  }
  const headerStore = await headers();
  const token = extractBearerToken(headerStore.get('authorization'));
  if (!token) {
    return { user: null, authError: first.error };
  }
  const second = await supabase.auth.getUser(token);
  return { user: second.data.user ?? null, authError: second.error };
}

