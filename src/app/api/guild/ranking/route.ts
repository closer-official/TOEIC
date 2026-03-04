import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** 今週の月曜 0:00 JST と 日曜 23:59:59.999 JST を UTC の ISO 文字列で返す */
function getCurrentWeekRangeJST(): { start: string; end: string } {
  const now = new Date();
  const jstOffsetMin = 9 * 60;
  const jst = new Date(now.getTime() + (jstOffsetMin - now.getTimezoneOffset()) * 60 * 1000);
  const day = jst.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(jst);
  monday.setDate(jst.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const start = new Date(monday.getTime() - (jstOffsetMin - monday.getTimezoneOffset()) * 60 * 1000);
  const end = new Date(sunday.getTime() - (jstOffsetMin - sunday.getTimezoneOffset()) * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** GET: ギルドランキング（ギルド実力＝今週のメンバーベスト合計）。月〜日で集計。認証不要。 */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const { start: weekStart, end: weekEnd } = getCurrentWeekRangeJST();

    const { data: runs, error: runsErr } = await supabase
      .from('runs')
      .select('user_id, game_mode, score')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd);

    if (runsErr) {
      if (/relation.*runs|does not exist/i.test(runsErr.message)) {
        return NextResponse.json({ ranking: [], weekStart, weekEnd: null });
      }
      return NextResponse.json({ error: runsErr.message }, { status: 500 });
    }

    const userScores: Record<string, { part5: number; vocab: number }> = {};
    for (const r of runs ?? []) {
      const uid = (r as { user_id: string }).user_id;
      const mode = (r as { game_mode: string }).game_mode;
      const score = (r as { score: number }).score ?? 0;
      if (!userScores[uid]) userScores[uid] = { part5: 0, vocab: 0 };
      if (mode === 'part5') userScores[uid].part5 = Math.max(userScores[uid].part5, score);
      else if (mode === 'vocab') userScores[uid].vocab = Math.max(userScores[uid].vocab, score);
    }

    const userTotal: Record<string, number> = {};
    for (const [uid, s] of Object.entries(userScores)) {
      userTotal[uid] = s.part5 + s.vocab;
    }

    const { data: members, error: memErr } = await supabase
      .from('guild_members')
      .select('user_id, guild_id');

    if (memErr) {
      if (/relation.*guild_members|does not exist/i.test(memErr.message)) {
        return NextResponse.json({ ranking: [] });
      }
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    const guildScore: Record<string, number> = {};
    const guildMemberCount: Record<string, number> = {};
    for (const m of members ?? []) {
      const gid = (m as { guild_id: string }).guild_id;
      const uid = (m as { user_id: string }).user_id;
      guildScore[gid] = (guildScore[gid] ?? 0) + (userTotal[uid] ?? 0);
      guildMemberCount[gid] = (guildMemberCount[gid] ?? 0) + 1;
    }

    const guildIds = Object.keys(guildScore).filter((id) => (guildScore[id] ?? 0) > 0);
    if (guildIds.length === 0) {
      return NextResponse.json({ ranking: [], weekStart, weekEnd: null });
    }

    const sorted = [...guildIds].sort((a, b) => (guildScore[b] ?? 0) - (guildScore[a] ?? 0)).slice(0, 50);

    const { data: guildRows, error: guildErr } = await supabase
      .from('guilds')
      .select('id, name, emblem_url, level, leader_id')
      .in('id', sorted);

    if (guildErr) {
      if (/emblem_url|column.*does not exist/i.test(guildErr.message)) {
        const fallback = await supabase.from('guilds').select('id, name, level, leader_id').in('id', sorted);
        const list = (fallback.data ?? []).map((g) => ({ ...g, emblem_url: null }));
        const order = new Map(sorted.map((id, i) => [id, i]));
        const ranking = list
          .sort((a, b) => (order.get((a as { id: string }).id) ?? 99) - (order.get((b as { id: string }).id) ?? 99))
          .map((g: { id: string; name: string; emblem_url?: string | null; level: number; leader_id: string }) => ({
            id: g.id,
            name: g.name,
            emblem_url: null,
            level: g.level,
            leader_id: g.leader_id,
            memberCount: guildMemberCount[g.id] ?? 0,
            weekly_score: guildScore[g.id] ?? 0,
          }));
        return NextResponse.json({ ranking, weekStart, weekEnd: null });
      }
      return NextResponse.json({ error: guildErr.message }, { status: 500 });
    }

    const order = new Map(sorted.map((id, i) => [id, i]));
    const ranking = (guildRows ?? [])
      .sort((a, b) => (order.get((a as { id: string }).id) ?? 99) - (order.get((b as { id: string }).id) ?? 99))
      .map((g: { id: string; name: string; emblem_url?: string | null; level: number; leader_id: string }) => ({
        id: g.id,
        name: g.name,
        emblem_url: g.emblem_url ?? null,
        level: g.level,
        leader_id: g.leader_id,
        memberCount: guildMemberCount[g.id] ?? 0,
        weekly_score: guildScore[g.id] ?? 0,
      }));

    return NextResponse.json({ ranking, weekStart, weekEnd: null });
  } catch (err) {
    console.error('[guild/ranking] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
