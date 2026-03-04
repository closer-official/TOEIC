-- THE GRAND FLOOR: 全ギルド同一マップ・領土拡大・占領・城・サプライライン
-- 1 world = 1 global map. Terrain and resources fixed at creation.

-- World: dimensions, seed, mountains and special resources (fixed)
CREATE TABLE IF NOT EXISTS public.grand_floor_world (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  width INTEGER NOT NULL DEFAULT 100 CHECK (width > 0),
  height INTEGER NOT NULL DEFAULT 100 CHECK (height > 0),
  seed BIGINT NOT NULL DEFAULT 0,
  mountains JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{"x":1,"y":2}, ...]
  resources JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{"x":10,"y":20,"type":"chip_mine"}, {"type":"delphi"|"hermes"}, ...]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cell ownership and level (1–5; 5 = castle)
CREATE TABLE IF NOT EXISTS public.grand_floor_cells (
  world_id UUID NOT NULL REFERENCES public.grand_floor_world(id) ON DELETE CASCADE,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
  level SMALLINT NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 5),
  total_xp BIGINT NOT NULL DEFAULT 0,
  last_stack_at DATE,  -- 同一マスへの重ねがけは1日1回まで
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (world_id, x, y)
);
CREATE INDEX IF NOT EXISTS idx_grand_floor_cells_world_guild ON public.grand_floor_cells(world_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_grand_floor_cells_world_xy ON public.grand_floor_cells(world_id, x, y);

-- Chip mine claims (periodic chip harvest)
CREATE TABLE IF NOT EXISTS public.grand_floor_mine_claims (
  world_id UUID NOT NULL REFERENCES public.grand_floor_world(id) ON DELETE CASCADE,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  last_claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (world_id, x, y)
);

-- Daily ranking snapshot (for rewards: 1st, 2–3rd, 4–10th, participation)
CREATE TABLE IF NOT EXISTS public.grand_floor_daily_ranking (
  id BIGSERIAL PRIMARY KEY,
  world_id UUID NOT NULL REFERENCES public.grand_floor_world(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  rank INTEGER,
  cell_count INTEGER NOT NULL DEFAULT 0,
  castle_count INTEGER NOT NULL DEFAULT 0,
  occupation_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(world_id, snapshot_date, guild_id)
);
CREATE INDEX IF NOT EXISTS idx_grand_floor_daily_ranking_world_date ON public.grand_floor_daily_ranking(world_id, snapshot_date);

-- Guild columns: HQ position (fixed after check-in)
ALTER TABLE public.guilds
  ADD COLUMN IF NOT EXISTS grand_floor_hq_x INTEGER,
  ADD COLUMN IF NOT EXISTS grand_floor_hq_y INTEGER,
  ADD COLUMN IF NOT EXISTS grand_floor_joined_at TIMESTAMPTZ;

-- RLS
ALTER TABLE public.grand_floor_world ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grand_floor_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grand_floor_mine_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grand_floor_daily_ranking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grand_floor_world_select" ON public.grand_floor_world;
CREATE POLICY "grand_floor_world_select" ON public.grand_floor_world FOR SELECT USING (true);
DROP POLICY IF EXISTS "grand_floor_world_insert" ON public.grand_floor_world;
CREATE POLICY "grand_floor_world_insert" ON public.grand_floor_world FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "grand_floor_cells_select" ON public.grand_floor_cells;
CREATE POLICY "grand_floor_cells_select" ON public.grand_floor_cells FOR SELECT USING (true);
DROP POLICY IF EXISTS "grand_floor_cells_all_service" ON public.grand_floor_cells;
CREATE POLICY "grand_floor_cells_all_service" ON public.grand_floor_cells FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "grand_floor_mine_claims_select" ON public.grand_floor_mine_claims;
CREATE POLICY "grand_floor_mine_claims_select" ON public.grand_floor_mine_claims FOR SELECT USING (true);
DROP POLICY IF EXISTS "grand_floor_mine_claims_insert" ON public.grand_floor_mine_claims;
CREATE POLICY "grand_floor_mine_claims_insert" ON public.grand_floor_mine_claims FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "grand_floor_mine_claims_update" ON public.grand_floor_mine_claims;
CREATE POLICY "grand_floor_mine_claims_update" ON public.grand_floor_mine_claims FOR UPDATE USING (true);

DROP POLICY IF EXISTS "grand_floor_daily_ranking_select" ON public.grand_floor_daily_ranking;
CREATE POLICY "grand_floor_daily_ranking_select" ON public.grand_floor_daily_ranking FOR SELECT USING (true);

COMMENT ON TABLE public.grand_floor_world IS 'THE GRAND FLOOR: single global map. mountains/resources fixed.';
COMMENT ON TABLE public.grand_floor_cells IS 'Per-cell ownership: guild_id, level 1-5 (5=castle), total_xp. last_stack_at = 1 stack per cell per day.';
COMMENT ON COLUMN public.guilds.grand_floor_hq_x IS 'THE GRAND FLOOR HQ X (fixed after check-in).';
COMMENT ON COLUMN public.guilds.grand_floor_hq_y IS 'THE GRAND FLOOR HQ Y (fixed after check-in).';
