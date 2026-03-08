import { NextResponse } from 'next/server';
import { GACHA_ITEMS } from '@/lib/gacha-items';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';

/** GET: 自分の持ち物を取得 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

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
