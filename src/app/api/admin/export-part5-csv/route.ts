import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../auth';

export const dynamic = 'force-static';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

/** Part 5 問題を読み込み（Supabase + 静的JSON） */
async function loadAllPart5Questions() {
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
  const staticMain = load('part5-static.json');
  const staticExtra = load('part5-static-extra.json').map(
    (q: { id?: string; vocab_map?: object }, i: number) => ({
      ...q,
      id: q.id || `extra-${i + 1}`,
      vocab_map: q.vocab_map ?? {},
    })
  );
  const staticList = [...staticMain, ...staticExtra];

  const supabase = createAdminSupabaseClient();
  const { data: dbList } = await supabase
    .from('questions')
    .select('id, question, options, correct_index, explanation, category, difficulty')
    .order('created_at', { ascending: false });

  const dbItems = (dbList ?? []).map((r) => ({
    id: r.id,
    question: r.question,
    options: r.options,
    correct_index: r.correct_index,
    explanation: r.explanation ?? '',
    category: r.category ?? '語彙',
    difficulty: r.difficulty ?? '700',
  }));

  return { static: staticList, db: dbItems };
}

/** Part 5 問題をCSV形式でダウンロード */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const err = requireAdmin(req);
  if (err) return err;

  try {
    const { static: staticList, db } = await loadAllPart5Questions();

    const escape = (s: string) =>
      /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const formatRow = (
      id: string,
      q: string,
      opts: string[],
      correctIndex: number,
      exp: string,
      cat: string,
      diff: string
    ) => {
      const optA = opts[0] ?? '';
      const optB = opts[1] ?? '';
      const optC = opts[2] ?? '';
      const optD = opts[3] ?? '';
      return [
        id,
        escape(q),
        escape(optA),
        escape(optB),
        escape(optC),
        escape(optD),
        ['A', 'B', 'C', 'D'][correctIndex] ?? 'A',
        escape(exp),
        escape(cat),
        diff,
      ].join(',');
    };

    const rows: string[] = [];
    for (const r of db) {
      const opts = Array.isArray(r.options) ? r.options : [];
      rows.push(
        formatRow(
          r.id,
          r.question,
          opts,
          r.correct_index,
          r.explanation,
          r.category,
          r.difficulty
        )
      );
    }
    for (const r of staticList) {
      const opts = Array.isArray(r.options) ? r.options : [];
      rows.push(
        formatRow(
          r.id ?? '',
          r.question ?? '',
          opts,
          r.correct_index ?? 0,
          r.explanation ?? '',
          r.category ?? '語彙',
          r.difficulty ?? '700'
        )
      );
    }

    const csv = [
      'id,question,option_a,option_b,option_c,option_d,answer,explanation,category,difficulty',
      ...rows,
    ].join('\n');

    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="part5-questions.csv"',
      },
    });
  } catch (e) {
    console.error('[admin export-part5-csv]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
