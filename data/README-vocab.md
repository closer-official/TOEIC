# 英単語データ（単語全国モード）

- **NGSL**: `data/default-vocab.json`（出題のメイン出典）
- **TSL**: `data/tsl-vocab.json`（あれば NGSL と結合して出題。同一単語は意味をマージ）

## TSL を追加する

1. **TSL 用の JSON を用意する**  
   `data/tsl-vocab.json` を次の形式で作成する（`default-vocab.json` と同じ形）:
   ```json
   [
     { "word": "technical", "meanings": ["技術的な", "専門の"] }
   ]
   ```
2. **配置**  
   上記ファイルを `data/tsl-vocab.json` として保存する。
3. **動作**  
   `/api/vocab-default` は `default-vocab.json`（NGSL）と `tsl-vocab.json`（TSL）の両方を読み、単語ごとに意味をマージして返す。`tsl-vocab.json` が無い場合は NGSL のみ。

Excel から TSL 用 JSON を作る場合、第2引数で出力先を指定する:
   ```bash
   node scripts/excel-to-default-vocab.js data/TSLのExcel.xlsx data/tsl-vocab.json
   ```

## 最新データへの差し替え（Excel → default-vocab.json）

1. **Excel を `data/` に置く**  
   例: `基礎英単語_TOEIC最適化_完成版.xlsx`

2. **変換を実行**  
   ```bash
   npm run vocab:from-excel
   ```
   または  
   ```bash
   node scripts/excel-to-default-vocab.js [Excelファイルパス]
   ```
   省略時は `data/基礎英単語_TOEIC最適化_完成版.xlsx` を読む。

3. **DB の管理者用単語を空にする（任意）**  
   Supabase の `global_vocabulary` を空にして、出題を `default-vocab.json` だけにしたい場合:
   ```bash
   npx supabase db push
   ```
   または `supabase/migrations/20260306000000_clear_global_vocabulary.sql` を適用。

## 想定している Excel の列

- **単語**: 列名が「単語」「word」「英単語」のいずれか
- **意味**: 列名が「意味」「訳」「meaning」「translation」「意味1」「意味2」「translation_1」「translation_2」など。複数列は 1 単語の meanings 配列にまとまる（出題時はこのうちランダムに1つのみ使用。同単語の translation_1 と translation_2 は同時に出題しない）。
- 品詞列は使わず、表示もしない。4択の正解・不正解は「意味の文言から推測した品詞」が同じになるように揃える。

## 出力形式

`default-vocab.json` は次の形の配列（品詞は出力しない）:

```json
[
  { "word": "example", "meanings": ["例示する", "例である"] }
]
```

`/api/vocab-default` はこのファイル（と DB の `global_vocabulary`）を結合して返す。
