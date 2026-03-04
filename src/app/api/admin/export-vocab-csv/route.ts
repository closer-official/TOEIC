import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../auth';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

/** 単語一覧をCSV形式でダウンロード（default-vocab.json + global_vocabulary） */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const err = requireAdmin(req);
  if (err) return err;

  try {
    const filePath = join(process.cwd(), 'data', 'default-vocab.json');
    let list: Array<{ word: string; pos?: string; meanings?: string[] }> = [];
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }

    const supabase = createAdminSupabaseClient();
    const { data: globalList } = await supabase
      .from('global_vocabulary')
      .select('word, meanings, pos')
      .order('created_at', { ascending: false });
    if (globalList?.length) {
      const merged = [
        ...globalList.map((r) => ({
          word: r.word,
          pos: r.pos ?? undefined,
          meanings: Array.isArray(r.meanings) ? r.meanings : [],
        })),
        ...list,
      ];
      const seen = new Set<string>();
      list = merged.filter((r) => {
        const key = r.word.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    const escape = (s: string) =>
      /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const rows = list.map((r) => {
      const word = escape(r.word);
      const meanings = escape(
        Array.isArray(r.meanings) ? r.meanings.join('、') : ''
      );
      const pos = escape(r.pos ?? '');
      return `${word},${meanings},${pos}`;
    });
    const csv = [
      'word,meanings,pos',
      ...rows,
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
