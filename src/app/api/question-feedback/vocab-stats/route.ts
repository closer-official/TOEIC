import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

/** 悪問としてこの数以上投票された選択肢は出題から除外 */
const BAD_VOTES_THRESHOLD = 5;

/** POST: 単語ごとの候補意味について wrong_selected_count / bad_votes を一括取得。4択の誤答3つを「誤答率トップ3・悪問除外」で選ぶために使用 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ items: [] });
    }
    const wordIds = [...new Set(items.map((x: { wordId?: string }) => String(x?.wordId ?? '').trim()).filter(Boolean))];
    if (wordIds.length === 0) {
      return NextResponse.json({ items: [] });
    }
    const { data: rows, error } = await supabase
      .from('question_choice_feedback')
      .select('question_id, choice_key, wrong_selected_count, bad_votes')
      .eq('source', 'vocab')
      .in('question_id', wordIds);
    if (error) {
      console.error('[question-feedback vocab-stats]', error);
      return NextResponse.json({ items: items.map((i: { wordId: string }) => ({ wordId: i.wordId, choices: [] })) });
    }
    const byWord = new Map<string, { text: string; wrongSelectedCount: number; badVotes: number }[]>();
    for (const r of rows ?? []) {
      const qid = (r as { question_id: string }).question_id;
      const key = (r as { choice_key: string }).choice_key;
      const wrong = (r as { wrong_selected_count: number }).wrong_selected_count ?? 0;
      const bad = (r as { bad_votes: number }).bad_votes ?? 0;
      if (!byWord.has(qid)) byWord.set(qid, []);
      byWord.get(qid)!.push({ text: key, wrongSelectedCount: wrong, badVotes: bad });
    }
    const result = items.map((item: { wordId: string; candidates?: string[] }) => {
      const wordId = String(item.wordId ?? '').trim();
      const candidates = Array.isArray(item.candidates) ? item.candidates : [];
      const choices = byWord.get(wordId) ?? [];
      const choiceMap = new Map(choices.map((c) => [c.text, c]));
      return {
        wordId,
        choices: candidates.map((text: string) => ({
          text,
          wrongSelectedCount: choiceMap.get(text)?.wrongSelectedCount ?? 0,
          badVotes: choiceMap.get(text)?.badVotes ?? 0,
        })),
        badVotesThreshold: BAD_VOTES_THRESHOLD,
      };
    });
    return NextResponse.json({ items: result });
  } catch (err) {
    console.error('[question-feedback vocab-stats]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
