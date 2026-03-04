# ランキング用 SQL 参照

ランキングの数字が更新されない場合、Supabase SQL Editor で以下を実行してデータとスキーマを確認してください。

---

## 1. ランキングAPIがやっていること（等価なSQL）

API（`/api/ranking/combined`）は次の2クエリに相当するデータを取得し、アプリ側で「ユーザーごとPart5最高」「ユーザーごと単語最高」を取って合算しています。

### Part5 のスコア上位（APIは limit 500）

```sql
SELECT user_id, score, total_time_ms
FROM public.runs
WHERE game_mode = 'part5'
ORDER BY score DESC, total_time_ms ASC
LIMIT 500;
```

### 単語のスコア上位（APIは limit 500）

```sql
SELECT user_id, score, total_time_ms
FROM public.runs
WHERE game_mode = 'vocab'
ORDER BY score DESC, total_time_ms ASC
LIMIT 500;
```

---

## 2. 合計ランキングをSQLだけで出す場合（確認用）

ユーザーごとに「Part5の最高得点」と「単語の最高得点」を足した合計でランキングを出す場合の例です。

```sql
WITH part5_best AS (
  SELECT DISTINCT ON (user_id) user_id, score AS part5_score
  FROM public.runs
  WHERE game_mode = 'part5'
  ORDER BY user_id, score DESC, total_time_ms ASC
),
vocab_best AS (
  SELECT DISTINCT ON (user_id) user_id, score AS vocab_score
  FROM public.runs
  WHERE game_mode = 'vocab'
  ORDER BY user_id, score DESC, total_time_ms ASC
),
combined AS (
  SELECT
    COALESCE(p.user_id, v.user_id) AS user_id,
    COALESCE(p.part5_score, 0) + COALESCE(v.vocab_score, 0) AS total_score
  FROM part5_best p
  FULL OUTER JOIN vocab_best v ON p.user_id = v.user_id
)
SELECT
  c.user_id,
  c.total_score,
  pr.username
FROM combined c
LEFT JOIN public.profiles pr ON pr.user_id = c.user_id
ORDER BY c.total_score DESC
LIMIT 50;
```

---

## 3. スキーマ・データ確認用

### runs に game_mode があるか確認

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'runs'
ORDER BY ordinal_position;
```

**注意:** 古い環境では `mode` のままのことがあります。その場合、APIの `.eq('game_mode', 'part5')` は `game_mode` 列を参照するため、列が `mode` だと条件に合う行が0件になります。

### 直近の runs がどう入っているか

```sql
SELECT id, user_id, score, total_time_ms, game_mode, survival_rank, created_at
FROM public.runs
ORDER BY created_at DESC
LIMIT 20;
```

（`game_mode` が無い場合は `mode` に読み替えてください。）

### game_mode 別の件数

```sql
SELECT game_mode, COUNT(*), MAX(created_at) AS latest
FROM public.runs
GROUP BY game_mode;
```

---

## 4. マイグレーション（runs のカラム名）

- `supabase/migrations/20250213150000_runs_mode_rank.sql` で **mode** を追加
- `supabase/migrations/20250213210000_runs_rename_mode_to_game_mode.sql` で **mode → game_mode** にリネーム
- `000_full_schema_copy_paste.sql` では **game_mode** を ADD COLUMN

本番で「mode のまま」なら、ランキング用の WHERE は次のいずれかで合わせる必要があります。

- マイグレーションで `game_mode` にリネームする  
  または
- API の `.eq('game_mode', ...)` を `.eq('mode', ...)` に変更する（一時対応）

---

## 5. RLS（参考）

```sql
-- runs: 全員SELECT可、自分の行だけINSERT可
-- CREATE POLICY "runs_select_all" ON public.runs FOR SELECT USING (true);
-- CREATE POLICY "runs_insert_own" ON public.runs FOR INSERT WITH CHECK (auth.uid() = user_id);
```

ランキングはサーバー側の Supabase クライアント（service role ではなく anon key + cookie）で読んでいるため、SELECT は RLS の「全員可」で問題ありません。数字が更新されない原因は、RLSより **game_mode / mode の有無・名前** の可能性が高いです。
