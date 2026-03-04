import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';


export const dynamic = 'force-static';

/** 1行1単語で「単語：意味1、意味2」をパース */
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

/** 自分の単語 For You に一括追加（認証必須） */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const raw = (body?.text ?? body?.body ?? '').toString().trim();
    if (!raw) {
      return NextResponse.json({ error: 'テキストを入力してください' }, { status: 400 });
    }

    const lines = raw.split(/\r?\n/);
    const parsed: { word: string; meanings: string[] }[] = [];
    for (const line of lines) {
      const p = parseVocabLine(line);
      if (p) parsed.push(p);
    }

    if (parsed.length === 0) {
      return NextResponse.json({
        error: 'パースできませんでした。「単語：意味1、意味2」の形式で1行1単語で入力してください。',
      }, { status: 400 });
    }

    let inserted = 0;
    for (const p of parsed) {
      const { error } = await supabase.from('user_vocabulary').upsert(
        {
          user_id: user.id,
          word: p.word.trim().toLowerCase(),
          meanings: p.meanings.slice(0, 5),
          source_question_id: null,
        },
        { onConflict: 'user_id,word' }
      );
      if (!error) inserted++;
    }

    return NextResponse.json({
      ok: true,
      count: inserted,
      message: `${inserted} 単語を単語 For You に追加しました。`,
    });
  } catch (e) {
    console.error('[my-vocab bulk-add]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
