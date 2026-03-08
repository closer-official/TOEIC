-- Apple IAP 取引の二重付与防止用
CREATE TABLE IF NOT EXISTS public.apple_transactions (
  transaction_id TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apple_transactions IS 'Apple IAP で付与済みの transactionId。二重付与防止用。';

-- RLS: 自ユーザーの行のみ参照可（サーバーは service role で挿入するためポリシーは不要だが、一応）
ALTER TABLE public.apple_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apple_transactions_select_own"
  ON public.apple_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "apple_transactions_insert_own"
  ON public.apple_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
