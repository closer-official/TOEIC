-- 大会週マスタ（賞品・ルール・優勝者）
CREATE TABLE IF NOT EXISTS public.tournament_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL UNIQUE,
  prize_label TEXT DEFAULT '',
  prize_yen INTEGER,
  rules_enabled BOOLEAN NOT NULL DEFAULT false,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_email_display TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tournament_weeks IS '大会: 週ごとの賞品・ルール（装備ON/OFF+レベル、個人/ギルド成長）。rules_enabled=false のときは全員フル使用。';
COMMENT ON COLUMN public.tournament_weeks.rules IS 'rules_enabled=true のときのみ使用。例: { "equipment": { "rensa_glass_pen": { "allowed": true, "level": 5 }, ... }, "personalGrowth": false, "guildGrowth": false }';
COMMENT ON COLUMN public.tournament_weeks.winner_email_display IS '優勝者連絡先用メール（表示・送付用）。';

CREATE INDEX IF NOT EXISTS idx_tournament_weeks_start_date ON public.tournament_weeks(start_date DESC);

-- 大会 run（日曜 12:00–23:00 のみ、Part5 1回・単語 1回まで）
CREATE TABLE IF NOT EXISTS public.tournament_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_week_id UUID NOT NULL REFERENCES public.tournament_weeks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('part5', 'vocab')),
  score INTEGER NOT NULL,
  total_time_ms INTEGER NOT NULL,
  run_question_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tournament_week_id, user_id, slot)
);

COMMENT ON TABLE public.tournament_runs IS '大会参加 run。1ユーザー・1週で part5 1本・vocab 1本まで。';
CREATE INDEX IF NOT EXISTS idx_tournament_runs_week_user ON public.tournament_runs(tournament_week_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_runs_week_score ON public.tournament_runs(tournament_week_id, score DESC);

ALTER TABLE public.tournament_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournament_weeks_select" ON public.tournament_weeks;
CREATE POLICY "tournament_weeks_select" ON public.tournament_weeks FOR SELECT USING (true);

DROP POLICY IF EXISTS "tournament_runs_select" ON public.tournament_runs;
CREATE POLICY "tournament_runs_select" ON public.tournament_runs FOR SELECT USING (true);
DROP POLICY IF EXISTS "tournament_runs_insert_own" ON public.tournament_runs;
CREATE POLICY "tournament_runs_insert_own" ON public.tournament_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
