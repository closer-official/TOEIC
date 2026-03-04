-- profiles に is_subscriber, subscription_tier が無い場合に追加（Webhook のサブスク反映用）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_subscriber BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT;

COMMENT ON COLUMN public.profiles.is_subscriber IS 'Stripe サブスク加入済みか';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'pro | ultra（メンバー | VIP）';
