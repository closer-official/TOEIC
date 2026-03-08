-- オフライン同期の冪等性: クライアント発行 run id を記録し重複送信を防ぐ
CREATE TABLE IF NOT EXISTS offline_synced_run_ids (
  client_run_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offline_synced_run_ids_user_id ON offline_synced_run_ids(user_id);
