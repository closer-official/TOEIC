import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-static';

const DEFAULT_BINDINGS = {
  topLeft: 's',
  bottomLeft: 'd',
  topRight: 'j',
  bottomRight: 'k',
} as const;

type KeyBindings = {
  topLeft: string;
  bottomLeft: string;
  topRight: string;
  bottomRight: string;
};

async function getSupabase() {
  return createApiSupabaseClient();
}

/** GET: 自分のキーバインドを取得 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await getSupabase();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json(DEFAULT_BINDINGS);
    }
    const { data } = await supabase
      .from('profiles')
      .select('key_bindings')
      .eq('user_id', user.id)
      .maybeSingle();
    const raw = data?.key_bindings;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      return NextResponse.json({
        topLeft: String(o.topLeft ?? DEFAULT_BINDINGS.topLeft),
        bottomLeft: String(o.bottomLeft ?? DEFAULT_BINDINGS.bottomLeft),
        topRight: String(o.topRight ?? DEFAULT_BINDINGS.topRight),
        bottomRight: String(o.bottomRight ?? DEFAULT_BINDINGS.bottomRight),
      });
    }
    return NextResponse.json(DEFAULT_BINDINGS);
  } catch (e) {
    console.error('[key-bindings GET]', e);
    return NextResponse.json(DEFAULT_BINDINGS);
  }
}

/** POST: 自分のキーバインドを保存 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await getSupabase();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({})) as Partial<KeyBindings>;
    const topLeft = body.topLeft != null ? String(body.topLeft).toLowerCase().slice(0, 1) : undefined;
    const bottomLeft = body.bottomLeft != null ? String(body.bottomLeft).toLowerCase().slice(0, 1) : undefined;
    const topRight = body.topRight != null ? String(body.topRight).toLowerCase().slice(0, 1) : undefined;
    const bottomRight = body.bottomRight != null ? String(body.bottomRight).toLowerCase().slice(0, 1) : undefined;
    const keyBindings: Record<string, string> = {};
    if (topLeft) keyBindings.topLeft = topLeft;
    if (bottomLeft) keyBindings.bottomLeft = bottomLeft;
    if (topRight) keyBindings.topRight = topRight;
    if (bottomRight) keyBindings.bottomRight = bottomRight;
    if (Object.keys(keyBindings).length === 0) {
      return NextResponse.json({ error: '少なくとも1つのキーを指定してください' }, { status: 400 });
    }
    const { data: existing } = await supabase
      .from('profiles')
      .select('key_bindings')
      .eq('user_id', user.id)
      .maybeSingle();
    const current = (existing?.key_bindings as Record<string, string>) ?? {};
    const merged = { ...DEFAULT_BINDINGS, ...current, ...keyBindings };
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, key_bindings: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(merged);
  } catch (e) {
    console.error('[key-bindings POST]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
