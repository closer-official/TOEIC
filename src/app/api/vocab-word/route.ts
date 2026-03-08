import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/** 品詞表記を除去（表示統一用）。英単語はそのまま返す。 */
function stripPosForDisplay(s: string): string {
  if (!s || typeof s !== 'string') return s;
  return String(s).trim();
}

/** vocab-word.json を読み込む（単語・品詞・意味＝正答英単語・ダミー1〜5）。単語→単語用。 */
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

/** 単語→単語全国モード用。data/vocab-word.json を参照。 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const dataDir = join(process.cwd(), 'data');
    const list = loadVocabWordJson(join(dataDir, 'vocab-word.json'));
    if (list.length === 0) {
      console.warn('[vocab-word] data/vocab-word.json is empty or missing.');
    }
    const version = `${list.length}`;
    return NextResponse.json({ list, version });
  } catch (err) {
    console.error('[vocab-word] Failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: '単語→単語リストの読み込みに失敗しました', code: 'vocab_word_load_failed' },
      { status: 503 }
    );
  }
}
