import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../auth';
import { createAdminSupabaseClient } from '@/lib/supabase/server';


export const dynamic = 'force-static';

/**
 * 単語行をパース
 * 例: Delegate：委譲する、代表者
 *     Assign：割り当てる、配属する
 * 区切り: ：（全角コロン）または :（半角）
 * 意味の区切り: 、（全角カンマ）または ,（半角）
 */
function parseVocabLine(line: string): { word: string; meanings: string[] } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const sep = trimmed.includes('：') ? '：' : trimmed.includes(':') ? ':' : null;
  if (!sep) return null;
  const [wordPart, meaningsPart] = trimmed.split(sep, 2).map((s) => s.trim());
  if (!wordPart) return null;
  const meanings = (meaningsPart ?? '')
    .split(/[、,]/)
    .map((m) => m.trim())
    .filter(Boolean);
  if (meanings.length === 0) return null;
  return { word: wordPart, meanings };
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

    const lines = raw.split(/\r?\n/);
    const parsed: { word: string; meanings: string[] }[] = [];
    for (const line of lines) {
      const p = parseVocabLine(line);
      if (p) parsed.push(p);
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        {
          error:
            'パースできませんでした。「単語：意味1、意味2」の形式で1行1単語で入力してください。',
        },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const inserted: string[] = [];
    for (const p of parsed) {
      const { error } = await supabase.from('global_vocabulary').insert({
        word: p.word.trim(),
        meanings: p.meanings.slice(0, 5),
        pos: null,
      });
      if (error) {
        console.error('[admin add-vocab] insert error', error);
        return NextResponse.json(
          { error: `追加に失敗: ${error.message}` },
          { status: 500 }
        );
      }
      inserted.push(p.word);
    }

    return NextResponse.json({
      ok: true,
      count: inserted.length,
      message: `${inserted.length} 単語を追加しました。単語全国モードで出題されます。`,
    });
  } catch (e) {
    console.error('[admin add-vocab]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
