import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

/** POST: 誤答時に選んだ選択肢を記録（誤答率の集計用） */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const source = (body.source as string) ?? 'vocab';
    const questionId = String(body.questionId ?? '').trim();
    const choiceKey = String(body.choiceKey ?? '').trim();
    if (!questionId || !choiceKey) {
      return NextResponse.json({ error: 'questionId と choiceKey が必要です' }, { status: 400 });
    }
    const { error: rpcError } = await supabase.rpc('increment_question_choice_feedback', {
      p_source: source,
      p_question_id: questionId,
      p_choice_key: choiceKey.slice(0, 500),
      p_wrong_delta: 1,
      p_bad_delta: 0,
    });
    if (rpcError) {
      console.error('[question-feedback record-wrong]', rpcError);
      return NextResponse.json({ error: '記録に失敗しました' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[question-feedback record-wrong]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
