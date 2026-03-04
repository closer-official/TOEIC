import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createServerSupabaseClient } from '@/lib/supabase/server';


export const dynamic = 'force-static';

/** 品詞表記を除去（旧データ・global_vocabulary 混在対策。品詞は表示しない仕様） */
function stripPosForDisplay(s: string): string {
  if (!s || typeof s !== 'string') return s;
  let t = s.trim();
  t = t.replace(/\s*[（(][動名形副接前助]詞?[）)]\s*$/g, '').trim();
  t = t.replace(/\s*[（(](形容詞|副詞|接続詞|前置詞|助動詞|動詞|名詞)[）)]\s*$/g, '').trim();
  t = t.replace(/^(動詞|名詞|形容詞|副詞|接続詞|前置詞|助動詞)\s+/, '').trim();
  t = t.replace(/^[動名形副接前助]\s+/, '').trim();
  return t;
}

function loadVocabFile(filePath: string): Array<{ word: string; meanings: string[] }> {
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const fromFile = Array.isArray(parsed) ? parsed : [];
    return fromFile.map((e: { word?: string; meanings?: string[] }) => {
      const word = stripPosForDisplay(String(e?.word ?? '').trim());
      const meanings = (Array.isArray(e?.meanings) ? e.meanings : []).map((m: unknown) => stripPosForDisplay(String(m ?? '').trim())).filter(Boolean);
      return { word, meanings };
    }).filter((e) => e.word.length > 0 && e.meanings.length > 0);
  } catch {
    return [];
  }
}

/** NGSL + TSL を1リストにマージ（同一 word は meanings を結合・重複除去） */
function mergeVocabLists(ngsl: Array<{ word: string; meanings: string[] }>, tsl: Array<{ word: string; meanings: string[] }>): Array<{ word: string; meanings: string[] }> {
  const byWord = new Map<string, Set<string>>();
  for (const e of ngsl) {
    if (!byWord.has(e.word)) byWord.set(e.word, new Set());
    e.meanings.forEach((m) => byWord.get(e.word)!.add(m));
  }
  for (const e of tsl) {
    if (!byWord.has(e.word)) byWord.set(e.word, new Set());
    e.meanings.forEach((m) => byWord.get(e.word)!.add(m));
  }
  return [...byWord.entries()].map(([word, set]) => ({ word, meanings: [...set] }));
}

/** 単語全国モード用デフォルト単語一覧（default-vocab.json = NGSL + tsl-vocab.json = TSL + 管理者追加の global_vocabulary） */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const dataDir = join(process.cwd(), 'data');
    const ngsl = loadVocabFile(join(dataDir, 'default-vocab.json'));
    const tsl = loadVocabFile(join(dataDir, 'tsl-vocab.json'));
    let list = mergeVocabLists(ngsl, tsl);
    if (list.length === 0 && ngsl.length === 0) {
      console.warn('[vocab-default] default-vocab.json load failed or empty');
    }

    try {
      const supabase = createServerSupabaseClient();
      const { data: globalList } = await supabase
        .from('global_vocabulary')
        .select('word, meanings, pos');
      if (globalList?.length) {
        const fromDb = globalList.map((r) => {
          const meanings = Array.isArray(r.meanings) ? r.meanings : [];
          return {
            word: stripPosForDisplay(String(r.word ?? '').trim()),
            meanings: meanings.map((m: unknown) => stripPosForDisplay(String(m ?? '').trim())).filter(Boolean),
          };
        }).filter((r) => r.word.length > 0 && r.meanings.length > 0);
        list = mergeVocabLists(list, fromDb);
      }
    } catch {
      // global_vocabulary テーブルが未作成の場合はスキップ
    }
    if (list.length === 0) {
      console.warn('[vocab-default] vocabulary list is empty');
    }
    return NextResponse.json(list);
  } catch (err) {
    console.error('[vocab-default] Failed:', err instanceof Error ? err.message : err);
    return NextResponse.json([]);
  }
}
