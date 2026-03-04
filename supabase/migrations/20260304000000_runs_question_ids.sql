-- Part5 直近3回の出題重複回避用: 各 run で出題した問題 ID を保存
ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS run_question_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.runs.run_question_ids IS 'このランで出題した Part5 問題の id 配列（UUID 文字列の配列）';
