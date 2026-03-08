-- ユーザー単体のXPブースター（ギルド未所属でも使用可能）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp_booster_ends_at TIMESTAMPTZ;
COMMENT ON COLUMN public.profiles.xp_booster_ends_at IS 'XPブースター効果終了時刻（個人用）。この時刻まで自分の獲得XPが2倍。ギルド未所属時に使用した場合に設定。';
