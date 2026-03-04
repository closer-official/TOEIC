import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { GACHA_ITEMS } from '@/lib/gacha-items';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** GET: 自分の持ち物を取得 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // read-only
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

    const { data, error } = await supabase
      .from('user_inventory')
      .select('item_id, quantity')
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const byItem = new Map<string, number>();
    for (const row of data ?? []) {
      const cur = byItem.get(row.item_id) ?? 0;
      byItem.set(row.item_id, cur + (row.quantity ?? 1));
    }

    const items = [...byItem.entries()].map(([itemId, quantity]) => {
      const def = GACHA_ITEMS.find((it) => it.id === itemId);
      return {
        id: itemId,
        name: def?.name ?? itemId,
        rarity: def?.rarity ?? 'N',
        quantity,
      };
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
