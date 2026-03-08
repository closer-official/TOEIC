-- Apple IAP 検証済み取引の記録（二重付与防止）
CREATE TABLE IF NOT EXISTS public.apple_transactions (
  transaction_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apple_transactions IS 'Apple StoreKit 2 で検証済みの取引。同一 transaction_id は一度だけ付与する。';

CREATE INDEX IF NOT EXISTS idx_apple_transactions_user_id ON public.apple_transactions(user_id);

-- Apple サブスク有効期限（iOS 経由のサブスクのみ。Stripe は stripe_subscription_id で管理）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apple_subscription_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.apple_subscription_expires_at IS 'Apple IAP サブスクの有効期限（UTC）。過ぎていれば tier は無効として扱う。';
