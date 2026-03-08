/**
 * 紹介者コードの検証。Firestore users/{code} または アプリ内 account_id (en-xxxxx) のいずれかが存在すれば有効。
 */

import { createClient } from '@supabase/supabase-js';
import { isValidReferrerCode } from '@/lib/firebase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Firestore の users/{code} または profiles.account_id が存在すれば true */
export async function isValidReferrerCodeOrAppAccount(code: string): Promise<boolean> {
  const trimmed = (code ?? '').trim();
  if (!trimmed) return false;
  if (await isValidReferrerCode(trimmed)) return true;
  if (!supabaseServiceRoleKey) return false;
  const admin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data } = await admin
    .from('profiles')
    .select('user_id')
    .eq('account_id', trimmed)
    .maybeSingle();
  return !!data;
}
