import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { readFileSync } from 'fs';
import { join } from 'path';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const STATIC_QUESTION_SHAPE = {
  id: '',
  question: '',
  options: [] as string[] | [string, string, string, string],
  correct_index: 0,
  explanation: null as string | null,
  category: '',
  difficulty: '',
  vocab_map: {} as Record<string, string[]>,
};

/** 静的 Part 5 問題を読み込む（part5-static.json + part5-static-extra.json をマージ。Supabase が空のときのフォールバック用） */
function loadStaticQuestions(): Array<{
  id: string;
  question: string;
  options: string[] | [string, string, string, string];
  correct_index: number;
  explanation: string | null;
  category: string;
  difficulty: string;
  vocab_map?: Record<string, string[]>;
}> {
  const baseDir = join(process.cwd(), 'data');
  const load = (filename: string) => {
    try {
      const raw = readFileSync(join(baseDir, filename), 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };
  const main = load('part5-static.json');
  const extra = load('part5-static-extra.json').map((q: typeof STATIC_QUESTION_SHAPE, i: number) => ({
    ...q,
    id: q.id || `extra-${i + 1}`,
    vocab_map: q.vocab_map ?? {},
  }));
  return [...main, ...extra];
}

/** GET: mode=national | forYou, userId (for For You), limit */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') ?? 'national';
  const limit = Math.min(50, Math.max(10, parseInt(searchParams.get('limit') ?? '20', 10)));

  // For You: 認証で user_logs を読み、間違えた問題の種類（品詞/語彙等）の類題を優先
  if (mode === 'forYou') {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
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
    } = await supabaseAuth.auth.getUser();
    if (!authError && user) {
      const { data: logs } = await supabaseAuth
        .from('user_logs')
        .select('question_id, correct, category')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      const byCategory: Record<string, { correct: number; total: number }> = {};
      const recentWrongCategories: string[] = [];
      const seenWrong = new Set<string>();
      logs?.forEach((log) => {
        byCategory[log.category] = byCategory[log.category] ?? { correct: 0, total: 0 };
        byCategory[log.category].total++;
        if (log.correct) byCategory[log.category].correct++;
        if (!log.correct && log.category && !seenWrong.has(log.category)) {
          seenWrong.add(log.category);
          recentWrongCategories.push(log.category);
        }
      });
      const weakCategories = Object.entries(byCategory)
        .filter(([, v]) => v.total >= 3 && v.correct / v.total < 0.6)
        .map(([c]) => c)
        .slice(0, 5);
      const priorityCategories = [...recentWrongCategories, ...weakCategories.filter((c) => !seenWrong.has(c))].slice(0, 8);
      if (priorityCategories.length > 0) {
        const { data: priorityQuestions } = await supabaseAuth
          .from('questions')
          .select('*')
          .in('category', priorityCategories)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (priorityQuestions?.length) {
          const rest = limit - priorityQuestions.length;
          const ids = new Set(priorityQuestions.map((q) => q.id));
          const { data: others } = await supabaseAuth
            .from('questions')
            .select('*')
            .not('id', 'in', `(${Array.from(ids).join(',')})`)
            .limit(rest > 0 ? rest : 1);
          const merged = [...priorityQuestions, ...(others ?? [])].slice(0, limit);
          return NextResponse.json(merged);
        }
      }
    }
  }

  const supabase = createServerSupabaseClient();

  // national: 全件取得してランダムに出題。直近3回の run で出題した問題はなるべく避ける
  if (mode === 'national') {
    const { data: allRows, error: fetchError } = await supabase
      .from('questions')
      .select('*');
    if (fetchError) {
      const staticQuestions = loadStaticQuestions();
      if (staticQuestions.length > 0) {
        const shuffled = shuffleArray([...staticQuestions]);
        return NextResponse.json({
          questions: shuffled.slice(0, limit),
          totalCount: staticQuestions.length,
        });
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    let pool = allRows ?? [];
    let totalCount = pool.length;

    // 認証ユーザー: 直近3回の Part5 run で出題した問題 ID を取得して除外
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
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
    } = await supabaseAuth.auth.getUser();
    if (user?.id) {
      const { data: recentRuns } = await supabase
        .from('runs')
        .select('*')
        .eq('user_id', user.id)
        .eq('game_mode', 'part5')
        .order('created_at', { ascending: false })
        .limit(3);
      const excludeIds = new Set<string>();
      for (const r of recentRuns ?? []) {
        const ids = (r as { run_question_ids?: unknown })?.run_question_ids;
        if (Array.isArray(ids)) {
          ids.forEach((id: unknown) => {
            if (typeof id === 'string') excludeIds.add(id);
          });
        }
      }
      if (excludeIds.size > 0 && pool.length > limit) {
        const preferred = pool.filter((q) => !excludeIds.has(q.id));
        pool = preferred.length >= limit ? preferred : pool;
      }
    }

    const shuffled = shuffleArray(pool);
    const list = shuffled.slice(0, limit);
    if (list.length === 0) {
      const staticQuestions = loadStaticQuestions();
      if (staticQuestions.length > 0) {
        const fallback = shuffleArray([...staticQuestions]).slice(0, limit);
        return NextResponse.json({
          questions: fallback,
          totalCount: staticQuestions.length,
        });
      }
      return NextResponse.json({ questions: [], totalCount: 0 });
    }
    return NextResponse.json({
      questions: list,
      totalCount,
    });
  }

  const query = supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(limit);
  const { data, error } = await query;
  if (error) {
    const staticQuestions = loadStaticQuestions();
    if (staticQuestions.length > 0) {
      return NextResponse.json(staticQuestions.slice(0, limit));
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const list = data?.slice(0, limit) ?? [];
  if (list.length === 0) {
    const staticQuestions = loadStaticQuestions();
    if (staticQuestions.length > 0) {
      return NextResponse.json(staticQuestions.slice(0, limit));
    }
  }
  return NextResponse.json(list);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
