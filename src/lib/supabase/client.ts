import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let _client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'));
}

/** 実機（Capacitor）のときのみ true。セッションを Preferences に永続化するために使用 */
function isCapacitorApp(): boolean {
  if (process.env.NEXT_PUBLIC_CAPACITOR_APP === '1') return true;
  if (typeof window === 'undefined') return false;
  const Cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Cap?.isNativePlatform?.() === true;
}

/** Capacitor 用のストレージ。Supabase のセッションをネイティブの Preferences に保存し、フルリロード後も復元できるようにする */
function getCapacitorStorage(): { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> } {
  return {
    async getItem(key: string) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return value;
    },
    async setItem(key: string, value: string) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
    },
    async removeItem(key: string) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
    },
  };
}

export function createClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (!_client) {
      _client = createSupabaseClient(
        'https://placeholder.supabase.co',
        'placeholder-key',
        { auth: { persistSession: true, autoRefreshToken: true } }
      );
    }
    return _client;
  }
  if (!_client) {
    if (isCapacitorApp()) {
      _client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: getCapacitorStorage(),
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } else {
      _client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    }
  }
  return _client;
}
