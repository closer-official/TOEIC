import { createClient } from '@supabase/supabase-js';
import { GACHA_ITEMS } from '@/lib/gacha-items';
import { GACHA_EQUIPMENT } from '@/lib/equipment-items';
import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** 1 XP = 0.01 チップ（100 XP = 1 チップ） */
const GEMS_PER_XP = 0.01;

/** GET: レート（一律 1 XP = 0.01 チップ）、ユーザーのXP・チップ、出品一覧 */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab'); // 'exchange' | 'sell' | 'buy'
    const nameFilter = searchParams.get('name') ?? '';
    const rarityFilter = searchParams.get('rarity') ?? '';

    // レートは一律 1 全共通XP = 0.01 チップ（スナップショット不要）
    const gemsPerEx = GEMS_PER_XP;

    // ユーザーの全共通XP・ギルドXP・チップ（チップ交換に使えるのは全共通XPのみ）
    let userEx = 0;
    let userGuildXp = 0;
    let userGems = 0;
    const { data: profile } = await supabase
      .from('profiles')
      .select('evolution_points, guild_xp, gems')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profile) {
      const p = profile as { evolution_points?: number; guild_xp?: number; gems?: number };
      userEx = p.evolution_points ?? 0;
      userGuildXp = Math.max(0, p.guild_xp ?? 0);
      userGems = Math.max(0, p.gems ?? 0);
    }

    // 出品一覧（購入用）
    let listings: unknown[] = [];
    const adminSupabase = supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey)
      : supabase;
    const { data: listingsData } = await adminSupabase
      .from('marketplace_listings')
      .select('id, seller_id, item_type, item_id, quantity, price_gems, item_name, item_rarity, created_at, equipment_grade, equipment_level, effect_base')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);

    let filtered = (listingsData ?? []) as { id: string; seller_id: string; item_type: string; item_id: string; quantity: number; price_gems: number; item_name: string; item_rarity: string; created_at: string; equipment_grade?: string | null; equipment_level?: number | null; effect_base?: number | null }[];
    if (nameFilter) {
      filtered = filtered.filter((l) => l.item_name.toLowerCase().includes(nameFilter.toLowerCase()));
    }
    if (rarityFilter) {
      filtered = filtered.filter((l) => l.item_rarity === rarityFilter);
    }
    listings = filtered;

    // 自分の出品一覧
    const { data: myListingsData } = await adminSupabase
      .from('marketplace_listings')
      .select('id, item_type, item_id, item_name, item_rarity, quantity, price_gems, created_at, equipment_grade, equipment_level, effect_base')
      .eq('seller_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    const myListings = (myListingsData ?? []) as unknown[];

    // 自分の在庫（出品用）
    const { data: invData } = await adminSupabase
      .from('user_inventory')
      .select('item_id, quantity')
      .eq('user_id', user.id);
    const invByItem = new Map<string, number>();
    for (const row of invData ?? []) {
      const id = (row as { item_id: string }).item_id;
      const q = (row as { quantity: number }).quantity ?? 0;
      invByItem.set(id, (invByItem.get(id) ?? 0) + q);
    }
    const { data: equipData } = await adminSupabase
      .from('user_equipment')
      .select('equipment_id, quantity')
      .eq('user_id', user.id);
    const equipByItem = new Map<string, number>();
    for (const row of equipData ?? []) {
      const id = (row as { equipment_id: string }).equipment_id;
      const q = (row as { quantity: number }).quantity ?? 0;
      equipByItem.set(id, (equipByItem.get(id) ?? 0) + q);
    }
    const myInventory = {
      items: [...invByItem.entries()].map(([itemId, qty]) => {
        const def = GACHA_ITEMS.find((it) => it.id === itemId);
        return { id: itemId, name: def?.name ?? itemId, rarity: def?.rarity ?? 'N', quantity: qty };
      }),
      equipment: [...equipByItem.entries()].map(([equipId, qty]) => {
        const def = GACHA_EQUIPMENT.find((it) => it.id === equipId);
        return { id: equipId, name: def?.name ?? equipId, rarity: def?.rarity ?? 'N', quantity: qty };
      }),
    };

    return NextResponse.json({
      gemsPerEx,
      userEx,
      userGuildXp,
      userGems,
      currentUserId: user.id,
      listings,
      myListings,
      myInventory,
    });
  } catch (err) {
    console.error('[exchange] GET error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
