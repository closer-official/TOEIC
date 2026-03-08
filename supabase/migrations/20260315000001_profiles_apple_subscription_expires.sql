-- Apple IAP サブスクの有効期限（StoreKit 2 の expiresDate を保存）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apple_subscription_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.apple_subscription_expires_at IS 'Apple IAP で購入したサブスクの有効期限。過ぎていれば subscription_tier は実質無効。';
