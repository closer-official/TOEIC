-- 新しいマップにしたいとき用: 既存ワールドと参加状態をリセットする。
-- 適用後、次にワールド取得やチェックインが行われると新地形（山3–5%、15×15区画に資源1つ）で再生成される。

-- 全ギルドの THE GRAND FLOOR 参加を解除（本拠地を消す）
UPDATE public.guilds
SET grand_floor_hq_x = NULL, grand_floor_hq_y = NULL, grand_floor_joined_at = NULL
WHERE grand_floor_hq_x IS NOT NULL;

-- ワールド削除（CASCADE で grand_floor_cells, grand_floor_mine_claims, grand_floor_daily_ranking も削除される）
DELETE FROM public.grand_floor_world;
