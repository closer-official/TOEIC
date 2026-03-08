import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/** 品詞表記を除去（表示統一用） */
function stripPosForDisplay(s: string): string {
  if (!s || typeof s !== 'string') return s;
  let t = s.trim();
  t = t.replace(/\s*[（(][動名形副接前助]詞?[）)]\s*$/g, '').trim();
  t = t.replace(/\s*[（(](形容詞|副詞|接続詞|前置詞|助動詞|動詞|名詞)[）)]\s*$/g, '').trim();
  t = t.replace(/^(動詞|名詞|形容詞|副詞|接続詞|前置詞|助動詞)\s+/, '').trim();
  t = t.replace(/^[動名形副接前助]\s+/, '').trim();
  return t;
}

/** vocab.json を読み込む（単語・品詞・意味・ダミー1〜5）。品詞は問題文「単語[品詞]」用にそのまま返す */
function loadVocabJson(filePath: string): Array<{ word: string; pos?: string; meanings: string[]; dummies?: string[] }> {
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const fromFile = Array.isArray(parsed) ? parsed : [];
    const result: Array<{ word: string; pos?: string; meanings: string[]; dummies?: string[] }> = [];
    for (const e of fromFile as Array<{ word?: string; pos?: string; meaning?: string; dummies?: string[] }>) {
      const word = stripPosForDisplay(String(e?.word ?? '').trim());
      const meaning = stripPosForDisplay(String(e?.meaning ?? '').trim());
      if (!word || !meaning) continue;
      const pos = typeof e?.pos === 'string' ? e.pos.trim() : undefined;
      const dummies = Array.isArray(e.dummies)
        ? e.dummies.map((d: unknown) => stripPosForDisplay(String(d ?? '').trim())).filter(Boolean)
        : [];
      result.push({ word, pos: pos || undefined, meanings: [meaning], dummies: dummies.length >= 3 ? dummies : undefined });
    }
    return result;
  } catch {
    return [];
  }
}

/** 単語全国モード用。data/vocab.json のみ参照 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const dataDir = join(process.cwd(), 'data');
    const list = loadVocabJson(join(dataDir, 'vocab.json'));
    if (list.length === 0) {
      console.warn('[vocab-default] vocab.json is empty or missing. Run: npm run vocab:import');
    }
    const version = `${list.length}`;
    return NextResponse.json({ list, version });
  } catch (err) {
    console.error('[vocab-default] Failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: '単語リストの読み込みに失敗しました', code: 'vocab_load_failed' },
      { status: 503 }
    );
  }
}
