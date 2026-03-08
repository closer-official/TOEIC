import { NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

/** 自分の単語 For You を CSV でダウンロード（認証必須） */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { data: list, error } = await supabase
      .from('user_vocabulary')
      .select('word, meanings')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const escape = (s: string) =>
      /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const rows = (list ?? []).map((r) => {
      const word = escape(r.word ?? '');
      const meanings = escape(Array.isArray(r.meanings) ? r.meanings.join('、') : '');
      return `${word},${meanings}`;
    });
    const csv = ['word,meanings', ...rows].join('\n');

    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="my-vocab-for-you.csv"',
      },
    });
  } catch (e) {
    console.error('[my-vocab export-csv]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
