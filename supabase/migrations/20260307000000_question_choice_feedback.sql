-- 4択の誤答選択率・悪問投票用（選択肢ごとに誤答で選ばれた回数と悪問投票を記録し、出題時に誤答率トップ3かつ悪問除外で使う）
CREATE TABLE IF NOT EXISTS public.question_choice_feedback (
  source text NOT NULL DEFAULT 'vocab',
  question_id text NOT NULL,
  choice_key text NOT NULL,
  wrong_selected_count int NOT NULL DEFAULT 0,
  bad_votes int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, question_id, choice_key)
);

COMMENT ON TABLE public.question_choice_feedback IS 'vocab: question_id=単語, choice_key=選択肢テキスト。誤答時に選ばれた回数と悪問投票。bad_votesが一定以上なら出題から除外。';

-- RLS: 認証ユーザーは読み取り・自分の記録用に挿入/更新可能
ALTER TABLE public.question_choice_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated"
  ON public.question_choice_feedback FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for authenticated"
  ON public.question_choice_feedback FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for authenticated"
  ON public.question_choice_feedback FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- カウント加算用（INSERT or UPDATE + 加算）
CREATE OR REPLACE FUNCTION public.increment_question_choice_feedback(
  p_source text,
  p_question_id text,
  p_choice_key text,
  p_wrong_delta int DEFAULT 0,
  p_bad_delta int DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO question_choice_feedback (source, question_id, choice_key, wrong_selected_count, bad_votes, updated_at)
  VALUES (p_source, p_question_id, p_choice_key, GREATEST(0, p_wrong_delta), GREATEST(0, p_bad_delta), now())
  ON CONFLICT (source, question_id, choice_key)
  DO UPDATE SET
    wrong_selected_count = question_choice_feedback.wrong_selected_count + GREATEST(0, p_wrong_delta),
    bad_votes = question_choice_feedback.bad_votes + GREATEST(0, p_bad_delta),
    updated_at = now();
END;
$$;
