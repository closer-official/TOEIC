import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/** 単語全国モード用デフォルト単語一覧 */
export async function GET() {
  try {
    const path = join(process.cwd(), 'data', 'default-vocab.json');
    const raw = readFileSync(path, 'utf8');
    const list = JSON.parse(raw);
    return NextResponse.json(Array.isArray(list) ? list : []);
  } catch {
    return NextResponse.json([]);
  }
}
