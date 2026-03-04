import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { readFileSync } from 'fs';
import { join } from 'path';


export const dynamic = 'force-static';

/** GET: Part5 登録問題数（Supabase questions + 静的フォールバック用 part5-static.json） */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = createServerSupabaseClient();
    const { count, error } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true });
    if (!error && typeof count === 'number') {
      return NextResponse.json({ part5: count, source: 'supabase' });
    }
    const baseDir = join(process.cwd(), 'data');
    try {
      const raw = readFileSync(join(baseDir, 'part5-static.json'), 'utf8');
      const data = JSON.parse(raw);
      const n = Array.isArray(data) ? data.length : 0;
      let extra = 0;
      try {
        const rawExtra = readFileSync(join(baseDir, 'part5-static-extra.json'), 'utf8');
        const dataExtra = JSON.parse(rawExtra);
        extra = Array.isArray(dataExtra) ? dataExtra.length : 0;
      } catch {
        // ignore
      }
      return NextResponse.json({ part5: n + extra, source: 'static' });
    } catch {
      return NextResponse.json({ part5: 0, source: 'none' });
    }
  } catch (err) {
    console.error('[questions/count]', err);
    return NextResponse.json({ part5: 0, source: 'error' });
  }
}
