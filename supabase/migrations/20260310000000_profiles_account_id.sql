-- アプリ内固有ID（en-xxxxx）。紹介者コードとして入力しても有効（users/{accountId} と同様）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_account_id ON public.profiles(account_id) WHERE account_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.account_id IS 'アプリ内固有ID。形式 en-xxxxxxxxx（9文字）。紹介者コードとしても使用可能。';
