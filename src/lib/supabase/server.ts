import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Server/API 用（anon key で RLS が user を判定） */
export function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
