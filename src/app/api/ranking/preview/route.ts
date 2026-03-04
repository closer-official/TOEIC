import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';


export const dynamic = 'force-static';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** GET: ランキング上位20件（単語+Part5 合計得点）。ホーム画面の下スクロール用。runs_best_per_user ビューでベスト1件のみ取得するため更新が反映される。 */
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

    const part5Res = await supabase
      .from('runs_best_per_user')
      .select('user_id, score, total_time_ms')
      .eq('game_mode', 'part5');

    const vocabRes = await supabase
      .from('runs_best_per_user')
      .select('user_id, score, total_time_ms')
      .eq('game_mode', 'vocab');

    const part5Best = new Map<string, { score: number }>(
      (part5Res.data ?? []).map((r) => [r.user_id, { score: r.score }])
    );
    const vocabBest = new Map<string, { score: number }>(
      (vocabRes.data ?? []).map((r) => [r.user_id, { score: r.score }])
    );

    const allUserIds = new Set([...part5Best.keys(), ...vocabBest.keys()]);
    const combined: { user_id: string; score: number }[] = [];
    for (const uid of allUserIds) {
      const p = part5Best.get(uid)?.score ?? 0;
      const v = vocabBest.get(uid)?.score ?? 0;
      combined.push({ user_id: uid, score: p + v });
    }
    combined.sort((a, b) => b.score - a.score);
    const previewLimit = 20;
    const candidateLimit = Math.min(combined.length, Math.max(previewLimit * 3, 60));
    const candidates = combined.slice(0, candidateLimit);
    const userIds = candidates.map((r) => r.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url')
      .in('user_id', userIds);

    const profileByUserId = new Map<string, { username: string | null; avatar_url: string | null }>();
    for (const p of profilesData ?? []) {
      const row = p as { user_id: string; username?: string | null; avatar_url?: string | null };
      profileByUserId.set(row.user_id, {
        username: row.username ?? null,
        avatar_url: row.avatar_url ?? null,
      });
    }

    const hasUsername = (u: string) => (profileByUserId.get(u)?.username ?? '').trim() !== '';
    const list = candidates.filter((r) => hasUsername(r.user_id)).slice(0, previewLimit);

    if (list.length === 0) {
      return NextResponse.json({ runs: [] });
    }

    const runs = list.map((r, i) => {
      const profile = profileByUserId.get(r.user_id);
      return {
        id: r.user_id,
        rank: i + 1,
        user_id: r.user_id,
        score: r.score,
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
      };
    });

    return NextResponse.json({ runs });
  } catch {
    return NextResponse.json({ runs: [] });
  }
}
