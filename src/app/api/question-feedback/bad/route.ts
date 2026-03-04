import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** 悪問として一定数投票されると出題から除外する閾値 */
const BAD_VOTES_THRESHOLD = 5;

/** POST: 悪問投票（この選択肢を出題から除外するための投票） */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore
          }
        },
      },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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
      p_wrong_delta: 0,
      p_bad_delta: 1,
    });
    if (rpcError) {
      console.error('[question-feedback bad]', rpcError);
      return NextResponse.json({ error: '記録に失敗しました' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, threshold: BAD_VOTES_THRESHOLD });
  } catch (err) {
    console.error('[question-feedback bad]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
