import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** POST: { userId, questionId, correct, responseTimeMs, category } */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();
  const { userId, questionId, correct, responseTimeMs, category } = body;
  if (!userId || !questionId || typeof correct !== 'boolean' || typeof responseTimeMs !== 'number' || !category) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  }
  const { error } = await supabase.from('user_logs').insert({
    user_id: userId,
    question_id: questionId,
    correct,
    response_time_ms: responseTimeMs,
    category,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
