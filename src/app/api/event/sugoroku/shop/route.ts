import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, getCurrentWeekIndex } from '@/lib/weekly-events';
import { createApiSupabaseClient, getApiUser } from '@/lib/api-auth';


export const dynamic = 'force-dynamic';

/** 基本価格。通常サイコロは固定100チップ、他は時価0.5〜2.5倍 */
const BASE_PRICES = {
  dice: 100,
  golden_dice: 300,
  xp_overdrive: 300,
  stamina_infinity: 300,
} as const;

/** 通常サイコロは常に100チップ（時価変動なし） */
const DICE_FIXED_PRICE = 100;

export type ShopItemId = keyof typeof BASE_PRICES;

/** GET: ショップ価格（入店のたびに 0.5〜2.5 倍ランダム）。借金中は利用不可なので 403 */
export async function GET(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const isPreview = req.nextUrl.searchParams.get('preview') === '1' || req.nextUrl.searchParams.get('dev') === '1' || req.headers.get('x-preview') === '1';
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    if (getCurrentEvent().id !== 'sugoroku' && !isPreview) {
      return NextResponse.json({ error: '今週は運命のすごろくではありません' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .maybeSingle();
    const gems = Math.floor(Number((profile as { gems?: number })?.gems ?? 0));
    if (gems < 0) {
      return NextResponse.json({ error: '借金中はショップを利用できません。獲得XPで返済してください。' }, { status: 403 });
    }

    const weekIndex = getCurrentWeekIndex();
    const multiplier = 0.5 + Math.random() * 2; // 0.5 〜 2.5
    const multRounded = Math.round(multiplier * 100) / 100;

    await supabase
      .from('sugoroku_progress')
      .update({
        shop_multiplier: multRounded,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('event_week_index', weekIndex);

    const items: { id: ShopItemId; name: string; basePrice: number; price: number }[] = [
      { id: 'dice', name: 'サイコロ（1個）', basePrice: BASE_PRICES.dice, price: Math.round(BASE_PRICES.dice * multRounded) },
      { id: 'golden_dice', name: '黄金のダイス（出目指定）', basePrice: BASE_PRICES.golden_dice, price: Math.round(BASE_PRICES.golden_dice * multRounded) },
      { id: 'xp_overdrive', name: 'XPオーバードライブ（30分2倍）', basePrice: BASE_PRICES.xp_overdrive, price: Math.round(BASE_PRICES.xp_overdrive * multRounded) },
      { id: 'stamina_infinity', name: 'スタミナ・インフィニティ（15分無制限）', basePrice: BASE_PRICES.stamina_infinity, price: Math.round(BASE_PRICES.stamina_infinity * multRounded) },
    ];

    return NextResponse.json({
      multiplier: multRounded,
      items,
      gems,
    });
  } catch (err) {
    console.error('[sugoroku shop GET]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** POST: 購入。body: { itemId: ShopItemId, quantity?: number }。チップはマイナスまで可能（借金） */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const supabase = await createApiSupabaseClient();
    const { user, authError } = await getApiUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const isPreviewPost = req.headers.get('x-preview') === '1' || req.headers.get('x-dev') === '1';
    if (getCurrentEvent().id !== 'sugoroku' && !isPreviewPost) {
      return NextResponse.json({ error: '今週は運命のすごろくではありません' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const itemId = body?.itemId as string;
    const quantity = Math.max(1, Math.floor(Number(body?.quantity) || 1));
    if (!itemId || !(itemId in BASE_PRICES)) {
      return NextResponse.json({ error: '無効な商品です' }, { status: 400 });
    }

    const weekIndex = getCurrentWeekIndex();
    const { data: progress } = await supabase
      .from('sugoroku_progress')
      .select('shop_multiplier, golden_dice_count, dice_count')
      .eq('user_id', user.id)
      .maybeSingle();

    const mult = Number((progress as { shop_multiplier?: number })?.shop_multiplier ?? 1);
    const basePrice = itemId === 'dice' ? DICE_FIXED_PRICE : BASE_PRICES[itemId as ShopItemId];
    const totalCost = (itemId === 'dice' ? DICE_FIXED_PRICE : Math.round(basePrice * mult)) * quantity;

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .maybeSingle();
    const currentGems = Math.floor(Number((profile as { gems?: number })?.gems ?? 0));
    const newGems = currentGems - totalCost;
    const now = new Date().toISOString();

    if (itemId === 'dice') {
      const currentDice = (progress as { dice_count?: number })?.dice_count ?? 0;
      await supabase
        .from('sugoroku_progress')
        .update({ dice_count: currentDice + quantity, updated_at: now })
        .eq('user_id', user.id);
      await supabase
        .from('profiles')
        .update({ gems: newGems, updated_at: now })
        .eq('user_id', user.id);
      return NextResponse.json({
        ok: true,
        itemId: 'dice',
        quantity,
        spentGems: totalCost,
        newGems,
        diceCount: currentDice + quantity,
      });
    }

    if (itemId === 'golden_dice') {
      const currentGolden = (progress as { golden_dice_count?: number })?.golden_dice_count ?? 0;
      await supabase
        .from('sugoroku_progress')
        .update({
          golden_dice_count: currentGolden + quantity,
          updated_at: now,
        })
        .eq('user_id', user.id);
      await supabase
        .from('profiles')
        .update({ gems: newGems, updated_at: now })
        .eq('user_id', user.id);
      return NextResponse.json({
        ok: true,
        itemId: 'golden_dice',
        quantity,
        spentGems: totalCost,
        newGems,
        goldenDiceCount: currentGolden + quantity,
      });
    }

    // xp_overdrive / stamina_infinity は所持のみ（効果は将来実装）
    await supabase
      .from('profiles')
      .update({ gems: newGems, updated_at: now })
      .eq('user_id', user.id);
    return NextResponse.json({
      ok: true,
      itemId,
      quantity,
      spentGems: totalCost,
      newGems,
    });
  } catch (err) {
    console.error('[sugoroku shop POST]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
