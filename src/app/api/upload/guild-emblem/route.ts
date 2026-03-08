import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** POST: ギルドエンブレム画像をアップロード（リーダーのみ）。multipart/form-data で file を送る。 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('guild_members')
      .select('guild_id, role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership || (membership as { role: string }).role !== 'leader') {
      return NextResponse.json({ error: 'ギルドリーダーのみアップロードできます' }, { status: 403 });
    }

    const guildId = (membership as { guild_id: string }).guild_id;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '画像ファイルを選択してください' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'JPEG/PNG/WebP/GIF のいずれかを選択してください' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'ファイルは2MB以下にしてください' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
    const path = `${guildId}/${Date.now()}.${safeExt}`;

    const { error: uploadErr } = await supabase.storage
      .from('guild-emblems')
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      if (uploadErr.message?.includes('Bucket not found') || uploadErr.message?.includes('bucket')) {
        return NextResponse.json(
          { error: 'ストレージの設定がありません。管理者に guild-emblems バケットの作成を依頼してください。' },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('guild-emblems').getPublicUrl(path);
    const url = urlData?.publicUrl ?? `${supabaseUrl}/storage/v1/object/public/guild-emblems/${path}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[upload guild-emblem]', err);
    return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 });
  }
}
