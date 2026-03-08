import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../auth';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** 単語一覧をCSV形式でダウンロード（vocab.json のみ） */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const err = requireAdmin(req);
  if (err) return err;

  try {
    const filePath = join(process.cwd(), 'data', 'vocab.json');
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'vocab.json がありません。npm run vocab:import を実行してください。' }, { status: 404 });
    }
    const raw = readFileSync(filePath, 'utf8');
    const list = JSON.parse(raw) as Array<{ word?: string; pos?: string; meaning?: string; dummies?: string[] }>;
    const rows = Array.isArray(list) ? list : [];

    const escape = (s: string) =>
      /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const csvRows = rows.map((r) => {
      const word = escape(String(r.word ?? '').trim());
      const pos = escape(String(r.pos ?? '').trim());
      const meaning = escape(String(r.meaning ?? '').trim());
      const dummies = Array.isArray(r.dummies) ? r.dummies : [];
      const d1 = escape(String(dummies[0] ?? '').trim());
      const d2 = escape(String(dummies[1] ?? '').trim());
      const d3 = escape(String(dummies[2] ?? '').trim());
      const d4 = escape(String(dummies[3] ?? '').trim());
      const d5 = escape(String(dummies[4] ?? '').trim());
      return `${word},${pos},${meaning},${d1},${d2},${d3},${d4},${d5}`;
    });
    const csv = [
      'word,pos,meaning,dummy1,dummy2,dummy3,dummy4,dummy5',
      ...csvRows,
    ].join('\n');

    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="vocabulary.csv"',
      },
    });
  } catch (e) {
    console.error('[admin export-vocab-csv]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
