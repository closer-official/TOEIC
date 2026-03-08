import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/**
 * POST: 退会処理。認証ユーザーを削除し、auth.users の CASCADE で
 * profiles / runs / user_equipment / user_inventory / guild_members 等の全データが削除される。
 */
export async function POST() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    if (!supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: '退会処理を実行できません。管理者設定を確認してください。' },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[account/delete]', deleteError.message);
      return NextResponse.json(
        { error: 'アカウントの削除に失敗しました。' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[account/delete]', err);
    return NextResponse.json(
      { error: '退会処理中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
