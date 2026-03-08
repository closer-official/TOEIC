import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/** 品詞表記を除去（表示統一用）。英単語にはほぼ影響しない */
function stripPosForDisplay(s: string): string {
  if (!s || typeof s !== 'string') return s;
  let t = s.trim();
  t = t.replace(/\s*[（(][動名形副接前助]詞?[）)]\s*$/g, '').trim();
  t = t.replace(/\s*[（(](形容詞|副詞|接続詞|前置詞|助動詞|動詞|名詞)[）)]\s*$/g, '').trim();
  t = t.replace(/^(動詞|名詞|形容詞|副詞|接続詞|前置詞|助動詞)\s+/, '').trim();
  t = t.replace(/^[動名形副接前助]\s+/, '').trim();
  return t;
}

/** vocab-word.json を読み込む（単語・品詞・意味＝英同義語・ダミー1〜5）。単語モードと同じ構造 */
function loadVocabWordJson(filePath: string): Array<{ word: string; meanings: string[]; dummies?: string[] }> {
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const fromFile = Array.isArray(parsed) ? parsed : [];
    const result: Array<{ word: string; meanings: string[]; dummies?: string[] }> = [];
    for (const e of fromFile as Array<{ word?: string; pos?: string; meaning?: string; dummies?: string[] }>) {
      const word = stripPosForDisplay(String(e?.word ?? '').trim());
      const meaning = stripPosForDisplay(String(e?.meaning ?? '').trim());
      if (!word || !meaning) continue;
      const dummies = Array.isArray(e.dummies)
        ? e.dummies.map((d: unknown) => stripPosForDisplay(String(d ?? '').trim())).filter(Boolean)
        : [];
      result.push({ word, meanings: [meaning], dummies: dummies.length >= 3 ? dummies : undefined });
    }
    return result;
  } catch {
    return [];
  }
}

/** 単語→単語全国モード用。data/vocab-word.json のみ参照 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const dataDir = join(process.cwd(), 'data');
    const list = loadVocabWordJson(join(dataDir, 'vocab-word.json'));
    if (list.length === 0) {
      console.warn('[vocab-word-default] vocab-word.json is empty or missing.');
    }
    const version = `${list.length}`;
    return NextResponse.json({ list, version });
  } catch (err) {
    console.error('[vocab-word-default] Failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: '単語→単語リストの読み込みに失敗しました', code: 'vocab_word_load_failed' },
      { status: 503 }
    );
  }
}
