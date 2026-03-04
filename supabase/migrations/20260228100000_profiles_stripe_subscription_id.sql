-- 解約（翌月まで有効）のため Stripe サブスクリプション ID を保持
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
COMMENT ON COLUMN public.profiles.stripe_subscription_id IS 'Stripe subscription id (sub_xxx). 解約時に cancel_at_period_end 用';
