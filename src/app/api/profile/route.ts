import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { isValidReferrerCode } from '@/lib/firebase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** GET: 自分のプロフィールを取得 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // ignore
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  }

  const baseCols = 'username, current_toeic_score, target_toeic_score, next_exam_date, referrer_id';
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`${baseCols}, avatar_url`)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    if (/column.*(avatar_url|does not exist)/i.test(error.message)) {
      const fallback = await supabase
        .from('profiles')
        .select(baseCols)
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
        avatar_url: '',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const p = profile as Record<string, unknown> | null;
  return NextResponse.json({
    username: p?.username ?? '',
    current_toeic_score: p?.current_toeic_score ?? null,
    target_toeic_score: p?.target_toeic_score ?? null,
    next_exam_date: p?.next_exam_date ?? null,
    referrer_id: p?.referrer_id ?? '',
    avatar_url: (typeof p?.avatar_url === 'string' ? p.avatar_url : '') || '',
  });
}

/** POST: プロフィールを保存。body: { username?, current_toeic_score?, target_toeic_score?, next_exam_date?, closer_id?, referrer_id?, avatar_url? } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // ignore
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

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

  // 紹介者コード: 空でなければ Firestore users/{code} の存在チェック。有効な場合のみ保存
  if (referrer_id !== undefined) {
    const code = typeof referrer_id === 'string' ? referrer_id.trim() : '';
    if (code !== '') {
      const valid = await isValidReferrerCode(code);
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
