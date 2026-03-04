import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../auth';
import { createAdminSupabaseClient } from '@/lib/supabase/server';


export const dynamic = 'force-static';

/**
 * Part 5 問題をパース
 * 例:
 *   We need to ( ) the risks associated with the new investment.
 *   (A) instigate
 *   (B) duplicate
 *   (C) mitigate
 *   (D) navigate
 *   正解: (C)
 *   解説: mitigate(軽減する)は、リスクや被害を和らげるという文脈で非常によく出ます。
 */
function parsePart5Block(text: string): {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  category: string;
  difficulty: string;
} | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 6) return null;

  let question = '';
  const options: string[] = [];
  let correctIndex = 0;
  let explanation = '';
  const category = '語彙';
  const difficulty = '700';

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^正解\s*[:：]\s*\(([A-D])\)/i.test(trimmed)) {
      const m = trimmed.match(/\(([A-D])\)/i);
      correctIndex = m ? ['A', 'B', 'C', 'D'].indexOf(m[1].toUpperCase()) : 0;
      continue;
    }
    if (/^解説\s*[:：]/.test(trimmed)) {
      explanation = trimmed.replace(/^解説\s*[:：]\s*/, '').trim();
      continue;
    }
    if (/^\(([A-D])\)\s*(.+)/i.test(trimmed)) {
      const m = trimmed.match(/^\(([A-D])\)\s*(.+)/i);
      if (m) {
        const idx = ['A', 'B', 'C', 'D'].indexOf(m[1].toUpperCase());
        options[idx] = m[2].trim();
      }
      continue;
    }
    if (!question && trimmed.length > 0 && !/^正解|^解説|^\([A-D]\)/i.test(trimmed)) {
      question = trimmed.replace(/\(\s*\)/g, '____').trim();
    }
  }

  const opts = [
    options[0] ?? '',
    options[1] ?? '',
    options[2] ?? '',
    options[3] ?? '',
  ];
  if (!question || opts.some((o) => !o)) return null;

  return {
    question,
    options: opts as [string, string, string, string],
    correctIndex: Math.max(0, Math.min(3, correctIndex)),
    explanation,
    category,
    difficulty,
  };
}

export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const err = requireAdmin(req);
  if (err) return err;

  try {
    const body = await req.json();
    const raw = (body?.text ?? body?.body ?? '').toString().trim();
    if (!raw) {
      return NextResponse.json(
        { error: 'テキストを入力してください' },
        { status: 400 }
      );
    }

    const blocks = raw.split(/\n\s*\n/).filter((b: string) => b.trim().length > 0);
    const parsed: ReturnType<typeof parsePart5Block>[] = [];
    for (const block of blocks) {
      const p = parsePart5Block(block);
      if (p) parsed.push(p);
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        {
          error:
            'パースできませんでした。問題文、(A)〜(D)、正解: (X)、解説: ... の形式で入力してください。',
        },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const inserted: string[] = [];
    for (const p of parsed) {
      const { error } = await supabase.from('questions').insert({
        question: p!.question,
        options: p!.options,
        correct_index: p!.correctIndex,
        explanation: p!.explanation || null,
        category: p!.category,
        difficulty: p!.difficulty,
        vocab_map: {},
      });
      if (error) {
        console.error('[admin add-part5] insert error', error);
        return NextResponse.json(
          { error: `追加に失敗: ${error.message}` },
          { status: 500 }
        );
      }
      inserted.push(p!.question.slice(0, 50));
    }

    return NextResponse.json({
      ok: true,
      count: inserted.length,
      message: `${inserted.length} 問を追加しました。全国モードで出題されます。`,
    });
  } catch (e) {
    console.error('[admin add-part5]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
