import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** POST: { userId, word, meanings, sourceQuestionId? } — Tap to Register */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();
  const { userId, word, meanings, sourceQuestionId } = body;
  if (!userId || !word || !Array.isArray(meanings)) {
    return NextResponse.json({ error: 'Missing userId, word, or meanings' }, { status: 400 });
  }
  const { error } = await supabase.from('user_vocabulary').upsert(
    {
      user_id: userId,
      word: String(word).trim().toLowerCase(),
      meanings: meanings.slice(0, 3),
      source_question_id: sourceQuestionId ?? null,
    },
    { onConflict: 'user_id,word' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** GET: ?userId — 登録単語一覧（単語寿司打用）。未ログイン時は空配列 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId || userId === 'anon') return NextResponse.json([]);
  const { data, error } = await supabase
    .from('user_vocabulary')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
