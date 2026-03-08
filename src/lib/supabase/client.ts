import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let _client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'));
}

export function createClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (!_client) {
      _client = createBrowserClient(
        'https://placeholder.supabase.co',
        'placeholder-key'
      );
    }
    return _client;
  }
  if (!_client) {
    _client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}
