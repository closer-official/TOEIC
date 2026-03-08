import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

/** GET: オフライン用 Part 5 全件。{ questions, version } */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const staticQuestions = loadStaticQuestions();
    const supabase = createServerSupabaseClient();
    const { data: dbRows, error } = await supabase.from('questions').select('*');
    let pool = dbRows ?? [];
    if (error && staticQuestions.length > 0) {
      pool = [];
    }
    const merged = pool.length > 0 ? [...pool] : [...staticQuestions];
    const version = `${merged.length}`;
    return NextResponse.json({ questions: merged, version });
  } catch (err) {
    console.error('[offline-bundle] Failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Part 5 の取得に失敗しました' }, { status: 503 });
  }
}
