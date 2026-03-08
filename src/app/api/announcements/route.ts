import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/auth';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { createApiSupabaseClient } from '@/lib/api-auth';

/** GET: 掲示板（運営からの連絡）を取得。認証不要。全ユーザーが閲覧可能。 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();

    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, body, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    return NextResponse.json({
      items: (data ?? []).map((r) => ({
        id: r.id,
        title: r.title ?? '',
        body: r.body ?? '',
        createdAt: r.created_at ?? new Date().toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

/** POST: 掲示板に投稿。管理者のみ（x-admin-secret または Authorization: Bearer）。管理者画面から書き込んだ内容を全ユーザーが読める。 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const err = requireAdmin(req);
  if (err) return err;

  try {
    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const bodyText = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'タイトルを入力してください' }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('announcements')
      .insert({ title, body: bodyText || '' })
      .select('id, title, body, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      item: {
        id: data?.id,
        title: data?.title ?? title,
        body: data?.body ?? bodyText,
        createdAt: data?.created_at ?? new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[announcements POST]', e);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
