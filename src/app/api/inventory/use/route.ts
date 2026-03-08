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

    // XPブースター：その場で使用可能。ギルド所属時はギルド全体、未所属時は自分だけ30分間2倍
    if (item_id === 'xp_booster') {
      const endsAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data: member } = await supabase
        .from('guild_members')
        .select('guild_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (member?.guild_id) {
        const { error: guildErr } = await supabase
          .from('guilds')
          .update({ xp_booster_ends_at: endsAt, updated_at: endsAt })
          .eq('id', (member as { guild_id: string }).guild_id);
        if (guildErr) {
          console.error('[inventory use] xp_booster guild update', guildErr.message);
        }
      }
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ xp_booster_ends_at: endsAt, updated_at: endsAt })
        .eq('user_id', user.id);
      if (profileErr) {
        if (/xp_booster_ends_at|column.*does not exist/i.test(profileErr.message)) {
          console.warn('[inventory use] profiles.xp_booster_ends_at not yet migrated');
        } else {
          console.error('[inventory use] xp_booster profile update', profileErr.message);
          return NextResponse.json({ error: '適用に失敗しました' }, { status: 500 });
        }
      }
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
