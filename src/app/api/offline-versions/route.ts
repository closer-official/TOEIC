import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function loadVocabJsonCount(filePath: string): number {
  if (!existsSync(filePath)) return 0;
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.filter((e: { word?: string; meaning?: string }) => String(e?.word ?? '').trim() && String(e?.meaning ?? '').trim()).length;
  } catch {
    return 0;
  }
}

function loadStaticPart5Count(): number {
  const baseDir = join(process.cwd(), 'data');
  const load = (filename: string) => {
    try {
      const raw = readFileSync(join(baseDir, filename), 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data.length : 0;
    } catch {
      return 0;
    }
  };
  return load('part5-static.json') + load('part5-static-extra.json');
}

/** GET: オフライン用バージョン比較用。{ vocabVersion, part5Version } */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const dataDir = join(process.cwd(), 'data');
    const vocabVersion = `${loadVocabJsonCount(join(dataDir, 'vocab.json'))}`;

    const staticCount = loadStaticPart5Count();
    let part5Count = staticCount;
    try {
      const supabase = createServerSupabaseClient();
      const { count, error } = await supabase.from('questions').select('*', { count: 'exact', head: true });
      if (!error && typeof count === 'number') part5Count = count;
    } catch {
      // use static count
    }
    const part5Version = `${part5Count}`;

    return NextResponse.json({ vocabVersion, part5Version });
  } catch (err) {
    console.error('[offline-versions] Failed:', err);
    return NextResponse.json({ vocabVersion: '0', part5Version: '0' });
  }
}
