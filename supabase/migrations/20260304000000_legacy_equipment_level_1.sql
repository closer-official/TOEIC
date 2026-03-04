-- 昔のガチャで level が保存されず 0 のままの所持装備を Lv.10 に補正する。
-- 当時は有料ガチャで Lv.1〜10（SR は 10〜20）が出ていたが DB に保存されていなかったため、
-- 効果は Lv.0 扱いなのにレベルアップ時だけ「そのレベル分の XP」を要求される不整合を解消する。
-- effect_base = 1 の行のみ対象（進化済みの level 0 はそのまま）。
UPDATE public.user_equipment
SET level = 10
WHERE level = 0
  AND effect_base = 1;
