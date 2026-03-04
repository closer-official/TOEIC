-- 出品は装備のみ。装備のグレード・レベル・effect_base を保存し、購入時にそのまま付与する
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS equipment_grade text,
  ADD COLUMN IF NOT EXISTS equipment_level int,
  ADD COLUMN IF NOT EXISTS effect_base real;

COMMENT ON COLUMN public.marketplace_listings.equipment_grade IS '装備のグレード (common, normal, rare, epic, legendary, eternal)';
COMMENT ON COLUMN public.marketplace_listings.equipment_level IS '装備のレベル';
COMMENT ON COLUMN public.marketplace_listings.effect_base IS '装備の効果基準値（進化引き継ぎ用）';
