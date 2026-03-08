import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { isValidReferrerCodeOrAppAccount } from '@/lib/referrer-validate';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';

/** en- で始まるアプリ内固有IDを生成（9文字英数字。Firestore users/{id} と被らないように） */
function generateAccountId(): string {
  return 'en-' + randomBytes(5).toString('hex').slice(0, 9);
}

/** GET: 自分のプロフィールを取得 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const supabase = await createApiSupabaseClient();
  const { user, authError } = await getApiUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  }

  const baseCols = 'username, current_toeic_score, target_toeic_score, next_exam_date, referrer_id, account_id';
  let profile: Record<string, unknown> | null = null;
  let selectError: { message: string } | null = null;

  const { data: profileData, error } = await supabase
    .from('profiles')
    .select(`${baseCols}, avatar_url`)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    if (/column.*(account_id|avatar_url|does not exist)/i.test(error.message)) {
      const fallback = await supabase
        .from('profiles')
        .select('username, current_toeic_score, target_toeic_score, next_exam_date, referrer_id, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      }
      const p = fallback.data as Record<string, unknown> | null;
      return NextResponse.json({
        username: p?.username ?? '',
        current_toeic_score: p?.current_toeic_score ?? null,
        target_toeic_score: p?.target_toeic_score ?? null,
        next_exam_date: p?.next_exam_date ?? null,
        referrer_id: p?.referrer_id ?? '',
        avatar_url: (typeof p?.avatar_url === 'string' ? p.avatar_url : '') || '',
        account_id: '',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const p = profileData as Record<string, unknown> | null;
  let accountId = (typeof p?.account_id === 'string' ? p.account_id : '') || '';

  if (p && !accountId) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const newId = generateAccountId();
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ account_id: newId, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (!updateErr) {
        accountId = newId;
        break;
      }
      if (updateErr.code !== '23505') {
        break;
      }
    }
  }

  return NextResponse.json({
    username: p?.username ?? '',
    current_toeic_score: p?.current_toeic_score ?? null,
    target_toeic_score: p?.target_toeic_score ?? null,
    next_exam_date: p?.next_exam_date ?? null,
    referrer_id: p?.referrer_id ?? '',
    avatar_url: (typeof p?.avatar_url === 'string' ? p.avatar_url : '') || '',
    account_id: accountId,
  });
}

/** POST: プロフィールを保存。body: { username?, current_toeic_score?, target_toeic_score?, next_exam_date?, closer_id?, referrer_id?, avatar_url? } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const supabase = await createApiSupabaseClient();
  const { user, authError } = await getApiUser(supabase);

  if (authError || !user) {
    return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  }

  const body = await req.json();
  const {
    username,
    current_toeic_score,
    target_toeic_score,
    next_exam_date,
    closer_id,
    referrer_id,
    avatar_url: avatarUrl,
  } = body;

  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (username !== undefined) row.username = username === '' ? null : String(username).trim();
  const cur = parseInt(current_toeic_score, 10);
  if (!Number.isNaN(cur)) row.current_toeic_score = cur;
  const tgt = parseInt(target_toeic_score, 10);
  if (!Number.isNaN(tgt)) row.target_toeic_score = tgt;
  if (next_exam_date !== undefined) row.next_exam_date = next_exam_date || null;
  if (closer_id !== undefined) row.closer_id = closer_id || null;

  // 紹介者コード: 空でなければ Firestore users/{code} または アプリ内 account_id (en-xxxxx) の存在チェック。自分のIDは不可。
  if (referrer_id !== undefined) {
    const code = typeof referrer_id === 'string' ? referrer_id.trim() : '';
    if (code !== '') {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const myAccountId = (myProfile as { account_id?: string } | null)?.account_id ?? '';
      if (myAccountId && code === myAccountId) {
        return NextResponse.json(
          { error: '自分の紹介者IDは入力できません。' },
          { status: 400 }
        );
      }
      const valid = await isValidReferrerCodeOrAppAccount(code);
      if (!valid) {
        return NextResponse.json(
          { error: '無効な紹介者コードです。' },
          { status: 400 }
        );
      }
    }
    row.referrer_id = code || null;
  }
  if (avatarUrl !== undefined) row.avatar_url = avatarUrl === '' ? null : String(avatarUrl).trim();

  let { error } = await supabase.from('profiles').upsert(row, { onConflict: 'user_id' });

  // avatar_url カラム未作成（"Could not find the 'avatar_url'" 等）の場合は除いて再試行
  const isAvatarColumnError =
    error &&
    row.avatar_url !== undefined &&
    (/avatar_url/i.test(error.message) || /column.*does not exist/i.test(error.message));
  if (isAvatarColumnError) {
    const { avatar_url: _a, ...rowWithoutAvatar } = row as Record<string, unknown> & { avatar_url?: unknown };
    const retry = await supabase.from('profiles').upsert(rowWithoutAvatar, { onConflict: 'user_id' });
    error = retry.error;
  }

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'このユーザー名は既に使用されています。別の名前を選んでください。' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // アバター変更時は Auth の user_metadata も更新し、トップバー等のアイコンと連動させる
  if (avatarUrl !== undefined) {
    const newAvatar = avatarUrl === '' ? null : String(avatarUrl).trim();
    await supabase.auth.updateUser({
      data: { avatar_url: newAvatar || undefined },
    });
  }

  return NextResponse.json({ ok: true });
}
