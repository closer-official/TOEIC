import { NextRequest, NextResponse } from 'next/server';

/** 管理者APIの認証。環境変数 ADMIN_SECRET と一致する値を Authorization: Bearer または x-admin-secret で送る。
 * コピペ時の前後空白・改行を無視するため両者を trim して比較する。 */
const ADMIN_SECRET = (process.env.ADMIN_SECRET ?? '').trim();

export function requireAdmin(req: NextRequest): NextResponse | null {
  if (!ADMIN_SECRET) {
    return NextResponse.json(
      { error: '管理者機能は未設定です（ADMIN_SECRET を設定してください）' },
      { status: 503 }
    );
  }
  const raw =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.headers.get('x-admin-secret') ??
    '';
  const auth = raw.trim();
  if (auth !== ADMIN_SECRET) {
    return NextResponse.json({ error: '認証が必要です（ADMIN_SECRET が一致しません）' }, { status: 401 });
  }
  return null;
}
