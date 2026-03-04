import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** POST: 使い切りアイテムを1個使用。body: { item_id } */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
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

    const body = await req.json().catch(() => ({}));
    const item_id = typeof body?.item_id === 'string' ? body.item_id.trim() : '';

    if (!item_id) {
      return NextResponse.json({ error: 'item_id を指定してください' }, { status: 400 });
    }

    const { data: rows } = await supabase
      .from('user_inventory')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('item_id', item_id)
      .order('quantity', { ascending: false });

    const total = (rows ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0);
    if (total < 1) {
      return NextResponse.json({ error: 'そのアイテムを所持していません' }, { status: 400 });
    }

    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: 'アイテムが見つかりません' }, { status: 400 });
    }

    const q = row.quantity ?? 0;
    if (q === 1) {
      await supabase.from('user_inventory').delete().eq('id', row.id);
    } else {
      await supabase.from('user_inventory').update({ quantity: q - 1 }).eq('id', row.id);
    }

    return NextResponse.json({ ok: true, remaining: total - 1 });
  } catch (err) {
    console.error('[inventory use]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
