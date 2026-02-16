-- Closer: TOEIC Part 5 統合システム
-- questions: 問題データ + Vocab Map (JSONB)
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  options TEXT[] NOT NULL CHECK (array_length(options, 1) = 4),
  correct_index SMALLINT NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
  explanation TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('500', '700', '900')),
  category TEXT NOT NULL,
  vocab_map JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_category ON public.questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions(created_at DESC);

COMMENT ON COLUMN public.questions.vocab_map IS '問題文・選択肢の単語 → TOEIC頻出意味上位3のマップ。例: {"affect": ["影響する","〜に作用する","感動させる"]}';

-- user_logs: 正誤・回答時間・カテゴリ（弱点分析用）
CREATE TABLE IF NOT EXISTS public.user_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  response_time_ms INTEGER NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_logs_user_id ON public.user_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON public.user_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_logs_category ON public.user_logs(user_id, category);

-- user_vocabulary: タップで登録した「自信ない」単語帳
CREATE TABLE IF NOT EXISTS public.user_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  meanings TEXT[] NOT NULL DEFAULT '{}',
  source_question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, word)
);

CREATE INDEX IF NOT EXISTS idx_user_vocabulary_user_id ON public.user_vocabulary(user_id);

-- runs: 全国ランキング用（1プレイあたりスコア・合計回答時間）
CREATE TABLE IF NOT EXISTS public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_time_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_score_time ON public.runs(score DESC, total_time_ms ASC);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON public.runs(created_at DESC);

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs_select_all" ON public.runs FOR SELECT USING (true);
CREATE POLICY "runs_insert_own" ON public.runs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;

-- questions: 全員読み取り可
CREATE POLICY "questions_select" ON public.questions FOR SELECT USING (true);

-- user_logs: 自分のレコードのみ
CREATE POLICY "user_logs_select" ON public.user_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_logs_insert" ON public.user_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_vocabulary: 自分のレコードのみ
CREATE POLICY "user_vocabulary_all" ON public.user_vocabulary
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
