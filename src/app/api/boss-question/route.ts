import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** GET: ボス用に1問返す。自分が間違えた問題を優先、なければランダム */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const mode = req.nextUrl.searchParams.get('mode') ?? 'part5';
  if (mode !== 'part5') {
    return NextResponse.json({ error: 'Boss is Part5 only' }, { status: 400 });
  }

  let questionIds: string[] = [];

  if (!authError && user) {
    const { data: wrongLogs } = await supabase
      .from('user_logs')
      .select('question_id')
      .eq('user_id', user.id)
      .eq('correct', false);
    const ids = [...new Set((wrongLogs ?? []).map((r) => r.question_id).filter(Boolean))];
    if (ids.length > 0) {
      questionIds = ids;
    }
  }

  if (questionIds.length === 0) {
    const { data: all } = await supabase
      .from('questions')
      .select('id')
      .limit(100);
    questionIds = (all ?? []).map((r) => r.id).filter(Boolean);
  }

  if (questionIds.length === 0) {
    return NextResponse.json({ error: 'No questions' }, { status: 404 });
  }

  const pickId = questionIds[Math.floor(Math.random() * questionIds.length)];
  const { data: row, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', pickId)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 500 });
  }

  const options = Array.isArray(row.options)
    ? (row.options.length === 4 ? row.options : [...row.options, '', '', ''].slice(0, 4))
    : [row.option_a, row.option_b, row.option_c, row.option_d].filter(Boolean);
  const q = {
    id: row.id,
    question: row.question,
    options: options as [string, string, string, string],
    correctIndex: row.correct_index ?? 0,
    type: 'grammar' as const,
    explanation: row.explanation ?? null,
    category: row.category ?? 'その他',
    difficulty: row.difficulty ?? '500',
    vocab_map: row.vocab_map ?? undefined,
  };
  return NextResponse.json(q);
}
