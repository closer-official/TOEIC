import { NextRequest, NextResponse } from 'next/server';
import { isValidReferrerCodeOrAppAccount } from '@/lib/referrer-validate';

export const dynamic = 'force-dynamic';

/**
 * GET: 紹介者コードの有効性を確認。?code=XXX
 * Firestore users/{code} または アプリ内 account_id (en-xxxxx) が存在すれば有効。認証不要。
 */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const code = req.nextUrl.searchParams.get('code') ?? '';
  const trimmed = code.trim();
  if (!trimmed) {
    return NextResponse.json({ valid: false, error: 'コードを入力してください' }, { status: 400 });
  }
  const valid = await isValidReferrerCodeOrAppAccount(trimmed);
  return NextResponse.json({ valid });
}
