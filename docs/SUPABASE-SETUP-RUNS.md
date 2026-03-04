# 全国ランキング用テーブル（runs）の作成

エラー `Could not find the table 'public.runs' in the schema cache` が出る場合、Supabase にテーブルが存在しません。

## 手順

1. [Supabase Dashboard](https://supabase.com/dashboard) でプロジェクト（例: `zbiibaclntwbidvabjge`）を開く
2. 左メニュー **SQL Editor** を開く
3. **New query** で以下を貼り付けて **Run** を実行する

```sql
-- 全国ランキング用テーブル（列名は game_mode。mode は PostgreSQL の集約関数名のため使わない）
CREATE TABLE IF NOT EXISTS public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_time_ms INTEGER NOT NULL,
  game_mode TEXT NOT NULL DEFAULT 'part5' CHECK (game_mode IN ('part5','vocab')),
  survival_rank TEXT NOT NULL DEFAULT 'ROOKIE' CHECK (survival_rank IN ('ROOKIE','ACE','LEGEND')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_score_time ON public.runs(score DESC, total_time_ms ASC);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON public.runs(created_at DESC);

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs_select_all" ON public.runs FOR SELECT USING (true);
CREATE POLICY "runs_insert_own" ON public.runs FOR INSERT WITH CHECK (auth.uid() = user_id);
```

4. 実行後、アプリでランキングが表示され、プレイ終了時にスコアが保存されるようになります。

**ランキングで 400 / WITHIN GROUP エラーが出る場合**は、次のいずれかを実行してください。

- 列が **`mode`** という名前のとき（リネーム）:
  ```sql
  ALTER TABLE public.runs RENAME COLUMN mode TO game_mode;
  ```
- 列 **`mode` も `game_mode` もない**とき（新規追加）:
  ```sql
  ALTER TABLE public.runs
    ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'part5' CHECK (game_mode IN ('part5','vocab')),
    ADD COLUMN IF NOT EXISTS survival_rank TEXT NOT NULL DEFAULT 'ROOKIE' CHECK (survival_rank IN ('ROOKIE','ACE','LEGEND'));
  ```
  ※ 既存の行には自動で `game_mode='part5'`, `survival_rank='ROOKIE'` が入ります。

## ランキングにユーザー名を出す場合（profiles テーブル）

SQL Editor で以下も実行してください。

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  current_toeic_score INTEGER,
  target_toeic_score INTEGER,
  next_exam_date DATE,
  closer_id TEXT,
  referrer_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

既に `profiles` がある場合は、Closer ID・紹介者ID 用に以下だけ実行してください。

```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS closer_id TEXT, ADD COLUMN IF NOT EXISTS referrer_id TEXT;
```

## 全テーブルをまとめて作成する場合

`supabase/migrations/20250213000000_schema.sql` を SQL Editor に貼り付けて実行しても構いません（`questions` など他テーブルも作成されます）。
