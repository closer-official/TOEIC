import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const BRACKET_RANGE = 50; // ±50点の範囲で同程度のユーザーを集める
const SCORE_SCALE = 2; // ゲームスコア差をTOEIC点に換算する係数
const BUCKET_SIZE = 100;
const MIN_USERS_FOR_ESTIMATE = 5;

/** 100点幅バケット: [0,100]=~100, [101,200]=100~200, ..., [901,1000]=900~1000 */
function getBuckets(): { low: number; high: number; label: string }[] {
  const buckets: { low: number; high: number; label: string }[] = [];
  buckets.push({ low: 0, high: 100, label: '~100' });
  for (let i = 1; i <= 9; i++) {
    const low = i * 100 + 1;
    const high = (i + 1) * 100;
    buckets.push({ low, high, label: `${i * 100}~${high}` });
  }
  return buckets;
}

/** GET: 自分のスコア履歴・予想TOEICスコア（認証必須） */
export async function GET() {
  if (process.env.BUILD_IOS === '1') return NextResponse.json({ error: 'Not available in static export' }, { status: 404 });
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

  const userId = user.id;

  // 1. プロフィール取得（current_toeic_score）
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_toeic_score')
    .eq('user_id', userId)
    .maybeSingle();

  const baseScore = profile?.current_toeic_score ?? 500;

  // 2. 自分のruns取得（スコア履歴）
  const { data: myRuns } = await supabase
    .from('runs')
    .select('score, total_time_ms, game_mode, survival_rank, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const scoreHistory = (myRuns ?? []).map((r) => ({
    score: r.score,
    totalTimeMs: r.total_time_ms,
    gameMode: r.game_mode ?? 'part5',
    survivalRank: r.survival_rank ?? 'ROOKIE',
    createdAt: r.created_at,
  }));

  const totalPlayTimeMs = (myRuns ?? []).reduce((acc, r) => acc + (r.total_time_ms ?? 0), 0);

  const part5Runs = scoreHistory.filter((r) => r.gameMode === 'part5');
  const vocabRuns = scoreHistory.filter((r) => r.gameMode === 'vocab');
  const modeStats = {
    part5: {
      count: part5Runs.length,
      avgScore: part5Runs.length > 0
        ? Math.round(part5Runs.reduce((a, r) => a + r.score, 0) / part5Runs.length)
        : 0,
    },
    vocab: {
      count: vocabRuns.length,
      avgScore: vocabRuns.length > 0
        ? Math.round(vocabRuns.reduce((a, r) => a + r.score, 0) / vocabRuns.length)
        : 0,
    },
  };

  // 3. 予想スコア算出：同程度（±50点）のユーザーの平均ゲームスコアと比較
  const low = Math.max(0, baseScore - BRACKET_RANGE);
  const high = Math.min(990, baseScore + BRACKET_RANGE);

  const { data: bracketProfiles } = await supabase
    .from('profiles')
    .select('user_id')
    .gte('current_toeic_score', low)
    .lte('current_toeic_score', high)
    .not('current_toeic_score', 'is', null);

  const bracketUserIds = (bracketProfiles ?? []).map((p) => p.user_id);

  let estimatedScore = baseScore;
  let bracketAvgScore: number | null = null;
  let userAvgScore: number | null = null;
  let sampleSize = 0;

  if (bracketUserIds.length > 0) {
    const { data: bracketRuns } = await supabase
      .from('runs')
      .select('user_id, score')
      .in('user_id', bracketUserIds);

    const runsByUser = new Map<string, number[]>();
    for (const r of bracketRuns ?? []) {
      if (!runsByUser.has(r.user_id)) runsByUser.set(r.user_id, []);
      runsByUser.get(r.user_id)!.push(r.score);
    }

    const userAverages: number[] = [];
    for (const [, scores] of runsByUser) {
      userAverages.push(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    if (userAverages.length > 0) {
      bracketAvgScore =
        userAverages.reduce((a, b) => a + b, 0) / userAverages.length;
      sampleSize = userAverages.length;

      const myScores = scoreHistory.map((r) => r.score);
      if (myScores.length > 0) {
        userAvgScore = myScores.reduce((a, b) => a + b, 0) / myScores.length;
        const diff = userAvgScore - bracketAvgScore;
        estimatedScore = Math.round(
          Math.max(0, Math.min(990, baseScore + diff / SCORE_SCALE))
        );
      }
    }
  }

  // 4. 成長の軌跡: 100点幅バケット別の人数・平均ゲームスコア（5人以上で表示）
  const buckets = getBuckets();
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('user_id, current_toeic_score')
    .not('current_toeic_score', 'is', null);

  const bucketUserIds = new Map<string, string[]>();
  for (const b of buckets) {
    bucketUserIds.set(b.label, []);
  }
  for (const p of allProfiles ?? []) {
    const s = p.current_toeic_score as number;
    if (s == null) continue;
    for (const b of buckets) {
      if (s >= b.low && s <= b.high) {
        bucketUserIds.get(b.label)!.push(p.user_id);
        break;
      }
    }
  }

  const scoreBuckets = buckets.map((b) => {
    const userIds = bucketUserIds.get(b.label) ?? [];
    const count = userIds.length;
    return { label: b.label, low: b.low, high: b.high, count, averageGameScore: null as number | null };
  });

  for (let i = 0; i < scoreBuckets.length; i++) {
    const bucket = scoreBuckets[i]!;
    if (bucket.count < MIN_USERS_FOR_ESTIMATE) continue;
    const userIds = bucketUserIds.get(bucket.label) ?? [];
    const { data: bracketRuns } = await supabase
      .from('runs')
      .select('user_id, score')
      .in('user_id', userIds);
    const byUser = new Map<string, number[]>();
    for (const r of bracketRuns ?? []) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
      byUser.get(r.user_id)!.push(r.score);
    }
    const averages = [...byUser.values()].map((scores) =>
      scores.reduce((a, b) => a + b, 0) / scores.length
    );
    if (averages.length > 0) {
      bucket.averageGameScore = Math.round(
        averages.reduce((a, b) => a + b, 0) / averages.length
      );
    }
  }

  const myBucketLabel = (() => {
    for (const b of buckets) {
      if (baseScore >= b.low && baseScore <= b.high) return b.label;
    }
    return null;
  })();

  return NextResponse.json({
    baseScore,
    estimatedScore,
    bracketAvgScore,
    userAvgScore,
    sampleSize,
    scoreHistory,
    totalPlayTimeMs,
    modeStats,
    scoreBuckets,
    myBucketLabel,
  });
}
