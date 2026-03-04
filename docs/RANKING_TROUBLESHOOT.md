# ランキングが反映されないときの確認

## 想定される原因

1. **未ログイン**  
   ゲーム終了時に「全国」でプレイしても、ログインしていないと `runs` に保存されません。ランキングへ遷移したあと、画面上に「ランキングに記録するにはログインしてください。」と出る場合はこれが原因です。

2. **DB に `game_mode` / `survival_rank` がない**  
   古いスキーマのままの場合、`runs` への INSERT が失敗したり、ランキング取得でエラーになったりします。  
   ランキングページに「データベースに game_mode / survival_rank がありません…」と出る場合は、以下の SQL を実行してください。

3. **RLS（Row Level Security）**  
   `runs` の INSERT は「`auth.uid() = user_id`」のときだけ許可されます。ログイン済みで、保存しようとしている `user_id` がそのユーザーと一致している必要があります。

4. **ネットワーク・Supabase 障害**  
   一時的なエラーの場合、再度プレイしてランキングへ遷移すると記録されることがあります。

---

## 管理者がやること（SQL）

Supabase Dashboard → SQL Editor で次を実行すると、`runs` に不足しているカラムを追加できます。

```sql
-- 既存の mode を game_mode にリネーム（必要な場合のみ）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'runs' AND column_name = 'mode')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'runs' AND column_name = 'game_mode') THEN
    ALTER TABLE public.runs RENAME COLUMN mode TO game_mode;
  END IF;
END $$;

ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'part5';
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS survival_rank TEXT NOT NULL DEFAULT 'ROOKIE';
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS checkpoints JSONB DEFAULT '[]'::jsonb;
```

同じ内容のマイグレーションは  
`supabase/migrations/20250219100000_runs_ensure_game_mode_survival_rank.sql` にもあります。

---

## 開発時の確認

- ブラウザのコンソールで `[runs insert]` のログを確認する。  
  エラーが出ていれば、メッセージ・details・hint で原因を特定できます。
- ランキングページで「記録に失敗しました: …」や「ランキングに記録するにはログインしてください。」の表示の有無を確認する。
