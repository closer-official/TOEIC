import { NextRequest, NextResponse } from 'next/server';
import { isValidReferrerCode } from '@/lib/firebase-admin';


export const dynamic = 'force-static';

/**
 * GET: 紹介者コードの有効性を確認。?code=XXX
 * Firestore users/{code} が存在すれば有効。認証不要（コードだけの照合）。
 */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const trimmed = code.trim();
  if (!trimmed) {
    return NextResponse.json({ valid: false, error: 'コードを入力してください' }, { status: 400 });
  }
  const valid = await isValidReferrerCode(trimmed);
  return NextResponse.json({ valid });
}
