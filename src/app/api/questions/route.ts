import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** GET: mode=national | forYou, userId (for For You), limit */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') ?? 'national';
  const userId = searchParams.get('userId');
  const limit = Math.min(50, Math.max(10, parseInt(searchParams.get('limit') ?? '20', 10)));

  let query = supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(mode === 'forYou' ? limit * 2 : limit);

  if (mode === 'forYou' && userId) {
    const { data: logs } = await supabase
      .from('user_logs')
      .select('question_id, correct, category')
      .eq('user_id', userId);
    const byCategory: Record<string, { correct: number; total: number }> = {};
    logs?.forEach((log) => {
      byCategory[log.category] = byCategory[log.category] ?? { correct: 0, total: 0 };
      byCategory[log.category].total++;
      if (log.correct) byCategory[log.category].correct++;
    });
    const weakCategories = Object.entries(byCategory)
      .filter(([, v]) => v.total >= 3 && v.correct / v.total < 0.6)
      .map(([c]) => c)
      .slice(0, 5);
    if (weakCategories.length > 0) {
      const { data: weakQuestions } = await supabase
        .from('questions')
        .select('*')
        .in('category', weakCategories)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (weakQuestions?.length) {
        const rest = limit - weakQuestions.length;
        const ids = new Set(weakQuestions.map((q) => q.id));
        const { data: others } = await supabase
          .from('questions')
          .select('*')
          .not('id', 'in', `(${Array.from(ids).join(',')})`)
          .limit(rest > 0 ? rest : 1);
        const merged = [...weakQuestions, ...(others ?? [])].slice(0, limit);
        return NextResponse.json(merged);
      }
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.slice(0, limit) ?? []);
}
