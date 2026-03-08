-- ギルド全体XPブースター（誰かが使用するとギルド員全員の獲得XPが2倍）
ALTER TABLE public.guilds
  ADD COLUMN IF NOT EXISTS xp_booster_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN public.guilds.xp_booster_ends_at IS 'XPブースター効果終了時刻。この時刻までギルド員の獲得XPが2倍。';

-- ギルドメンバーが自ギルドの xp_booster_ends_at を更新可能（XPブースター使用時）
DROP POLICY IF EXISTS "guilds_update_xp_booster" ON public.guilds;
CREATE POLICY "guilds_update_xp_booster" ON public.guilds
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guilds.id AND gm.user_id = auth.uid()));

-- スタミナインフィニティ（効果時間中はスタミナ消費なしでプレイ可能）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stamina_infinity_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.stamina_infinity_ends_at IS 'スタミナインフィニティ効果終了時刻。この時刻までプレイ時のスタミナ消費なし。';
