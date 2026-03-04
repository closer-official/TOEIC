import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent } from '@/lib/weekly-events';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const GEM_PER_TICKET = 100;
const PRIZE_TYPES = ['grand_prize', 'a', 'b_plus', 'b_minus', 'c', 'd_plus', 'd'] as const;
type PrizeType = (typeof PRIZE_TYPES)[number];

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
}

/** 現在の箱IDを取得（未抽選が1枚以上あるうちで最も古い箱）。なければ1箱作成して返す */
async function getOrCreateCurrentBoxId(supabase: ReturnType<typeof createServerClient>): Promise<string | null> {
  const { data: tickets } = await supabase
    .from('kuji_tickets')
    .select('box_id')
    .is('drawn_by', null);

  const boxIds = [...new Set((tickets ?? []).map((r: { box_id: string }) => r.box_id))];
  if (boxIds.length > 0) {
    const { data: boxRow } = await supabase
      .from('kuji_boxes')
      .select('id')
      .in('id', boxIds)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (boxRow?.id) return boxRow.id as string;
  }

  const { data: newBoxId, error: rpcErr } = await supabase.rpc('create_ichiban_box');
  if (rpcErr || !newBoxId) {
    console.error('[ichiban] create_ichiban_box failed', rpcErr?.message);
    return null;
  }
  return newBoxId as string;
}

/** 箱の残り枚数・賞別残りを取得 */
async function getBoxState(
  supabase: ReturnType<typeof createServerClient>,
  boxId: string
): Promise<{ remainingCount: number; remainingByPrize: Record<PrizeType, number> }> {
  const { data: tickets } = await supabase
    .from('kuji_tickets')
    .select('prize_type')
    .eq('box_id', boxId)
    .is('drawn_by', null);

  const remainingByPrize: Record<PrizeType, number> = {
    grand_prize: 0,
    a: 0,
    b_plus: 0,
    b_minus: 0,
    c: 0,
    d_plus: 0,
    d: 0,
  };
  for (const row of tickets ?? []) {
    const t = row.prize_type as PrizeType;
    if (PRIZE_TYPES.includes(t)) remainingByPrize[t]++;
  }
  const remainingCount = tickets?.length ?? 0;
  return { remainingCount, remainingByPrize };
}

/** GET: 現在の箱の状態（残り枚数・賞別残り）。未認証でも取得可 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();
    const supabase = createSupabase(cookieStore);

    const current = getCurrentEvent();
    if (current.id !== 'ichiban') {
      return NextResponse.json({ error: '今週は至高の1番くじではありません' }, { status: 404 });
    }

    const boxId = await getOrCreateCurrentBoxId(supabase);
    if (!boxId) {
      return NextResponse.json({ error: '箱の準備に失敗しました' }, { status: 500 });
    }

    const { remainingCount, remainingByPrize } = await getBoxState(supabase, boxId);
    return NextResponse.json({
      boxId,
      remainingCount,
      remainingByPrize,
    });
  } catch (err) {
    console.error('[ichiban GET]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** 景品を1つ付与 */
async function grantPrize(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  prizeType: PrizeType,
  isLastOne: boolean,
  now: string
): Promise<{ error?: string }> {
  if (prizeType === 'grand_prize') {
    const { error: invErr } = await supabase.from('user_inventory').insert({
      user_id: userId,
      item_id: 'eternal_cross_fragment',
      quantity: 2,
    });
    if (invErr) return { error: invErr.message };
  }
  if (isLastOne) {
    const { error: invErr } = await supabase.from('user_inventory').insert({
      user_id: userId,
      item_id: 'eternal_cross_fragment',
      quantity: 3,
    });
    if (invErr) return { error: invErr.message };
  }

  switch (prizeType) {
    case 'a': {
      const { data: p } = await supabase.from('profiles').select('evolution_points').eq('user_id', userId).maybeSingle();
      const cur = (p as { evolution_points?: number } | null)?.evolution_points ?? 0;
      const { error: e } = await supabase
        .from('profiles')
        .update({ evolution_points: cur + 10000, updated_at: now })
        .eq('user_id', userId);
      if (e) return { error: e.message };
      break;
    }
    case 'b_plus': {
      const { data: p } = await supabase.from('profiles').select('evolution_points').eq('user_id', userId).maybeSingle();
      const cur = (p as { evolution_points?: number } | null)?.evolution_points ?? 0;
      const { error: e } = await supabase
        .from('profiles')
        .update({ evolution_points: cur + 5000, updated_at: now })
        .eq('user_id', userId);
      if (e) return { error: e.message };
      break;
    }
    case 'b_minus':
      // スタミナ・インフィニティ30分: 簡易実装でスタミナ全回復＋evolution_points で代用 or 別カラム。ここではスタミナ全回復扱い（last_stamina_at を now にし、stamina_count を max に）
      {
        const { data: p } = await supabase
          .from('profiles')
          .select('stamina_count, last_stamina_at')
          .eq('user_id', userId)
          .maybeSingle();
        const maxStamina = 10; // 簡易
        const { error: e } = await supabase
          .from('profiles')
          .update({
            stamina_count: maxStamina,
            last_stamina_at: now,
            updated_at: now,
          })
          .eq('user_id', userId);
        if (e) return { error: e.message };
      }
      break;
    case 'c': {
      const { data: p } = await supabase.from('profiles').select('paid_gacha_ticket_pulls').eq('user_id', userId).maybeSingle();
      const cur = (p as { paid_gacha_ticket_pulls?: number } | null)?.paid_gacha_ticket_pulls ?? 0;
      const { error: e } = await supabase
        .from('profiles')
        .update({ paid_gacha_ticket_pulls: cur + 10, updated_at: now })
        .eq('user_id', userId);
      if (e) return { error: e.message };
      break;
    }
    case 'd_plus': {
      const { data: p } = await supabase.from('profiles').select('free_gacha_ticket_pulls').eq('user_id', userId).maybeSingle();
      const cur = (p as { free_gacha_ticket_pulls?: number } | null)?.free_gacha_ticket_pulls ?? 0;
      const { error: e } = await supabase
        .from('profiles')
        .update({ free_gacha_ticket_pulls: cur + 10, updated_at: now })
        .eq('user_id', userId);
      if (e) return { error: e.message };
      break;
    }
    case 'd': {
      const giveXp = Math.random() < 0.5;
      if (giveXp) {
        const { data: p } = await supabase.from('profiles').select('evolution_points').eq('user_id', userId).maybeSingle();
        const cur = (p as { evolution_points?: number } | null)?.evolution_points ?? 0;
        const { error: e } = await supabase
          .from('profiles')
          .update({ evolution_points: cur + 500, updated_at: now })
          .eq('user_id', userId);
        if (e) return { error: e.message };
      } else {
        const { data: p } = await supabase.from('profiles').select('gems').eq('user_id', userId).maybeSingle();
        const cur = (p as { gems?: number } | null)?.gems ?? 0;
        const { error: e } = await supabase
          .from('profiles')
          .update({ gems: cur + 55, updated_at: now })
          .eq('user_id', userId);
        if (e) return { error: e.message };
      }
      break;
    }
    default:
      break;
  }
  return {};
}

/** POST: くじを引く。body: { action: 'one' | 'all' }。認証必須 */
export async function POST(req: NextRequest) {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();
    const supabase = createSupabase(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    }

    const current = getCurrentEvent();
    if (current.id !== 'ichiban') {
      return NextResponse.json({ error: '今週は至高の1番くじではありません' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'all' ? 'all' : 'one';

    const boxId = await getOrCreateCurrentBoxId(supabase);
    if (!boxId) {
      return NextResponse.json({ error: '箱の準備に失敗しました' }, { status: 500 });
    }

    const { remainingCount, remainingByPrize } = await getBoxState(supabase, boxId);
    if (remainingCount === 0) {
      return NextResponse.json({ error: 'この箱は空です。再読み込みしてください。' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .maybeSingle();
    const gems = Math.max(0, (profile as { gems?: number } | null)?.gems ?? 0);

    const toDraw = action === 'all' ? remainingCount : 1;
    const cost = toDraw * GEM_PER_TICKET;
    if (gems < cost) {
      return NextResponse.json(
        { error: `チップが足りません。${cost}必要です。（所持: ${gems}）` },
        { status: 402 }
      );
    }

    const now = new Date().toISOString();

    if (action === 'one') {
      const { data: tickets } = await supabase
        .from('kuji_tickets')
        .select('id, prize_type')
        .eq('box_id', boxId)
        .is('drawn_by', null)
        .limit(200);

      const list = Array.isArray(tickets) ? tickets : [];
      const ticket = list.length > 0 ? list[Math.floor(Math.random() * list.length)]! : null;
      if (!ticket) {
        return NextResponse.json({ error: 'この箱は空です。再読み込みしてください。' }, { status: 400 });
      }

      const { error: updateErr } = await supabase
        .from('kuji_tickets')
        .update({ drawn_by: user.id, drawn_at: now })
        .eq('id', ticket.id)
        .is('drawn_by', null);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      const updated = await supabase.from('kuji_tickets').select('id').eq('id', ticket.id).eq('drawn_by', user.id).maybeSingle();
      if (!updated.data) {
        return NextResponse.json({ error: '他のユーザーに先に引かれました。もう一度お試しください。' }, { status: 409 });
      }

      const newRemaining = remainingCount - 1;
      const isLastOne = newRemaining === 0;

      const grantErr = await grantPrize(supabase, user.id, ticket.prize_type as PrizeType, isLastOne, now);
      if (grantErr.error) {
        return NextResponse.json({ error: '景品付与に失敗しました: ' + grantErr.error }, { status: 500 });
      }

      const { error: gemErr } = await supabase
        .from('profiles')
        .update({ gems: gems - GEM_PER_TICKET, updated_at: now })
        .eq('user_id', user.id);
      if (gemErr) {
        return NextResponse.json({ error: 'チップの消費に失敗しました' }, { status: 500 });
      }

      if (ticket.prize_type === 'grand_prize') {
        await supabase.rpc('create_ichiban_box');
      }

      return NextResponse.json({
        ok: true,
        prizeType: ticket.prize_type,
        isLastOne,
        remainingCount: newRemaining,
      });
    }

    // action === 'all': 残り全枚を取得して一括で drawn にし、景品を集計して付与
    const { data: allTickets } = await supabase
      .from('kuji_tickets')
      .select('id, prize_type')
      .eq('box_id', boxId)
      .is('drawn_by', null);

    if (!allTickets?.length) {
      return NextResponse.json({ error: 'この箱は空です。再読み込みしてください。' }, { status: 400 });
    }

    const ids = allTickets.map((t: { id: string }) => t.id);
    const { error: updateErr } = await supabase
      .from('kuji_tickets')
      .update({ drawn_by: user.id, drawn_at: now })
      .in('id', ids)
      .is('drawn_by', null);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const prizeCounts: Record<PrizeType, number> = {
      grand_prize: 0,
      a: 0,
      b_plus: 0,
      b_minus: 0,
      c: 0,
      d_plus: 0,
      d: 0,
    };
    let hasGrandPrize = false;
    for (const t of allTickets) {
      const pt = t.prize_type as PrizeType;
      if (PRIZE_TYPES.includes(pt)) prizeCounts[pt]++;
      if (pt === 'grand_prize') hasGrandPrize = true;
    }

    for (const pt of PRIZE_TYPES) {
      for (let i = 0; i < (prizeCounts[pt] ?? 0); i++) {
        const grantErr = await grantPrize(supabase, user.id, pt, false, now);
        if (grantErr.error) {
          return NextResponse.json({ error: '景品付与に失敗しました: ' + grantErr.error }, { status: 500 });
        }
      }
    }

    // ラストワン賞: 200枚目（箱の最後）を引いたユーザーに欠片×3
    const { error: lastOneErr } = await supabase.from('user_inventory').insert({
      user_id: user.id,
      item_id: 'eternal_cross_fragment',
      quantity: 3,
    });
    if (lastOneErr) {
      return NextResponse.json({ error: 'ラストワン賞付与に失敗しました: ' + lastOneErr.message }, { status: 500 });
    }

    const { error: gemErr } = await supabase
      .from('profiles')
      .update({ gems: gems - cost, updated_at: now })
      .eq('user_id', user.id);
    if (gemErr) {
      return NextResponse.json({ error: 'チップの消費に失敗しました' }, { status: 500 });
    }

    if (hasGrandPrize) {
      await supabase.rpc('create_ichiban_box');
    }

    return NextResponse.json({
      ok: true,
      drawnCount: allTickets.length,
      prizeCounts,
      isLastOne: true,
      remainingCount: 0,
    });
  } catch (err) {
    console.error('[ichiban POST]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
