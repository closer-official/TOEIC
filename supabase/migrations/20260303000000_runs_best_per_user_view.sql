-- ランキング用: ユーザー・モードごとのベスト1件（スコア降順、同点なら時間昇順）
-- これを使うことで「昔のベストを上回った」ときに必ずランキングに反映される
CREATE OR REPLACE VIEW public.runs_best_per_user AS
SELECT DISTINCT ON (user_id, game_mode)
  id,
  user_id,
  game_mode,
  score,
  total_time_ms,
  created_at
FROM public.runs
ORDER BY user_id, game_mode, score DESC, total_time_ms ASC;

COMMENT ON VIEW public.runs_best_per_user IS 'Ranking: one best run per user per game_mode (score desc, total_time_ms asc tiebreak).';
