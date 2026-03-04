import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Server/API 用（anon key で RLS が user を判定） */
export function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/** 管理者API用（RLSをバイパスして questions / global_vocabulary に INSERT 可能） */
export function createAdminSupabaseClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}
