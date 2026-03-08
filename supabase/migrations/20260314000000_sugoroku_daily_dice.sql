-- 毎日ログインで通常サイコロ3個付与用：最終付与日を記録
ALTER TABLE public.sugoroku_progress
ADD COLUMN IF NOT EXISTS last_daily_dice_date DATE;

COMMENT ON COLUMN public.sugoroku_progress.last_daily_dice_date IS '最後に毎日ログインボーナス（通常サイコロ3個）を付与した日（JST date）';
