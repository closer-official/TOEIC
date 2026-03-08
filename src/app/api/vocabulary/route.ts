import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

/** POST: { word, meanings, sourceQuestionId? } — Tap to Register（認証必須） */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }
    let body: { word?: unknown; meanings?: unknown; sourceQuestionId?: string | null };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const { word, meanings, sourceQuestionId } = body;
    if (word == null || word === '') {
      return NextResponse.json({ error: 'Missing word' }, { status: 400 });
    }
    const rawMeanings = Array.isArray(meanings) ? meanings : [word];
    const meaningsArr = rawMeanings.slice(0, 3).map((m) => String(m ?? ''));
    const wordStr = String(word).trim().toLowerCase();
    if (!wordStr) return NextResponse.json({ error: 'Missing word' }, { status: 400 });

    const { error } = await supabase.from('user_vocabulary').upsert(
      {
        user_id: user.id,
        word: wordStr,
        meanings: meaningsArr,
        source_question_id: sourceQuestionId ?? null,
      },
      { onConflict: 'user_id,word' }
    );
    if (error) {
      console.error('user_vocabulary upsert', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('vocabulary POST', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

/** GET: 登録単語一覧（認証必須。未ログイン時は空配列） */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) return NextResponse.json([]);
    const { data, error } = await supabase
      .from('user_vocabulary')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('user_vocabulary select', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error('vocabulary GET', err);
    return NextResponse.json([], { status: 200 });
  }
}
