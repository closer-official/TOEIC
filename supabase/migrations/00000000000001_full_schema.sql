-- =============================================================================
-- 瞬 (SHUN) フルスキーマ（1本化）
-- 既存のマイグレーションをすべて削除し、この1本だけを残して supabase db reset で適用する想定。
-- =============================================================================

-- 1. questions
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  options TEXT[] NOT NULL CHECK (array_length(options, 1) = 4),
  correct_index SMALLINT NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
  explanation TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('500', '700', '900')),
  category TEXT NOT NULL,
  vocab_map JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_category ON public.questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions(created_at DESC);

-- 2. user_logs
CREATE TABLE IF NOT EXISTS public.user_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  response_time_ms INTEGER NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_logs_user_id ON public.user_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON public.user_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_logs_category ON public.user_logs(user_id, category);

-- 3. user_vocabulary
CREATE TABLE IF NOT EXISTS public.user_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  meanings TEXT[] NOT NULL DEFAULT '{}',
  source_question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, word)
);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_user_id ON public.user_vocabulary(user_id);

-- 4. runs
CREATE TABLE IF NOT EXISTS public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_time_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  game_mode TEXT NOT NULL DEFAULT 'part5',
  survival_rank TEXT NOT NULL DEFAULT 'ROOKIE',
  checkpoints JSONB DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_runs_score_time ON public.runs(score DESC, total_time_ms ASC);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON public.runs(created_at DESC);

-- 5. profiles（全カラムを一括定義）
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  current_toeic_score INTEGER,
  target_toeic_score INTEGER,
  next_exam_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closer_id TEXT,
  referrer_id TEXT,
  key_bindings JSONB DEFAULT '{"topLeft":"s","bottomLeft":"d","topRight":"j","bottomRight":"k"}'::jsonb,
  stamina_count INTEGER NOT NULL DEFAULT 10,
  last_stamina_at TIMESTAMPTZ,
  is_subscriber BOOLEAN NOT NULL DEFAULT false,
  evolution_points INTEGER NOT NULL DEFAULT 0,
  evolution_correct_time INTEGER NOT NULL DEFAULT 0 CHECK (evolution_correct_time >= 0 AND evolution_correct_time <= 9),
  evolution_score INTEGER NOT NULL DEFAULT 0 CHECK (evolution_score >= 0 AND evolution_score <= 9),
  evolution_wrong_penalty INTEGER NOT NULL DEFAULT 0 CHECK (evolution_wrong_penalty >= 0 AND evolution_wrong_penalty <= 9),
  evolution_torso INTEGER NOT NULL DEFAULT 0 CHECK (evolution_torso >= 0 AND evolution_torso <= 9),
  avatar_url TEXT,
  subscription_tier TEXT,
  stripe_subscription_id TEXT,
  gems INTEGER NOT NULL DEFAULT 0,
  gacha_free_pulls_used_today INTEGER NOT NULL DEFAULT 0,
  gacha_free_reset_date DATE,
  paid_gacha_pity_count INTEGER NOT NULL DEFAULT 0,
  evolution_season TEXT,
  evolution_season_carry_correct_time NUMERIC NOT NULL DEFAULT 0,
  evolution_season_carry_score NUMERIC NOT NULL DEFAULT 0,
  evolution_season_carry_wrong_penalty NUMERIC NOT NULL DEFAULT 0,
  guild_xp INTEGER NOT NULL DEFAULT 0,
  equipped_weapon_equipment_id TEXT,
  equipped_weapon_grade TEXT,
  equipped_weapon_level INTEGER,
  equipped_weapon_effect_base REAL NOT NULL DEFAULT 1.0,
  equipped_head_equipment_id TEXT,
  equipped_head_grade TEXT,
  equipped_head_level INTEGER,
  equipped_head_effect_base REAL NOT NULL DEFAULT 1.0,
  equipped_torso_equipment_id TEXT,
  equipped_torso_grade TEXT,
  equipped_torso_level INTEGER,
  equipped_torso_effect_base REAL NOT NULL DEFAULT 1.0,
  equipped_feet_equipment_id TEXT,
  equipped_feet_grade TEXT,
  equipped_feet_level INTEGER,
  equipped_feet_effect_base REAL NOT NULL DEFAULT 1.0,
  paid_gacha_ticket_pulls INTEGER NOT NULL DEFAULT 0,
  free_gacha_ticket_pulls INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (LOWER(TRIM(username))) WHERE username IS NOT NULL AND TRIM(username) <> '';

-- 6. global_vocabulary
CREATE TABLE IF NOT EXISTS public.global_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  meanings TEXT[] NOT NULL DEFAULT '{}',
  pos TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_global_vocabulary_word ON public.global_vocabulary(LOWER(word));

-- 7. announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. user_inventory
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON public.user_inventory(user_id);

-- 9. user_equipment
CREATE TABLE IF NOT EXISTS public.user_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grade TEXT NOT NULL DEFAULT 'common' CHECK (grade IN ('common','normal','rare','epic','legendary','eternal')),
  level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0),
  effect_base REAL NOT NULL DEFAULT 1.0 CHECK (effect_base >= 0)
);
CREATE INDEX IF NOT EXISTS idx_user_equipment_user_id ON public.user_equipment(user_id);

-- 10. exchange_daily_snapshots
CREATE TABLE IF NOT EXISTS public.exchange_daily_snapshots (
  date DATE PRIMARY KEY,
  total_gems BIGINT NOT NULL DEFAULT 0,
  total_ex BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. marketplace_listings
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('item', 'equipment')),
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_gems INTEGER NOT NULL CHECK (price_gems > 0),
  item_name TEXT NOT NULL,
  item_rarity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON public.marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created ON public.marketplace_listings(created_at DESC);

-- 12. guilds
CREATE TABLE IF NOT EXISTS public.guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  leader_comment TEXT,
  emblem_url TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  total_donated_xp BIGINT NOT NULL DEFAULT 0,
  join_type TEXT NOT NULL DEFAULT 'open' CHECK (join_type IN ('open', 'approval', 'invite')),
  invite_code TEXT UNIQUE,
  tags TEXT[] DEFAULT '{}',
  leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lab_stamina_lv INTEGER NOT NULL DEFAULT 0 CHECK (lab_stamina_lv >= 0 AND lab_stamina_lv <= 10),
  lab_xp_lv INTEGER NOT NULL DEFAULT 0 CHECK (lab_xp_lv >= 0 AND lab_xp_lv <= 10),
  lab_score_lv INTEGER NOT NULL DEFAULT 0 CHECK (lab_score_lv >= 0 AND lab_score_lv <= 10),
  guild_season TEXT,
  guild_carry_stamina INTEGER NOT NULL DEFAULT 0,
  guild_carry_xp NUMERIC(5,4) NOT NULL DEFAULT 0,
  guild_carry_score NUMERIC(5,4) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_guilds_leader ON public.guilds(leader_id);
CREATE INDEX IF NOT EXISTS idx_guilds_join_type ON public.guilds(join_type);

-- 13. guild_members
CREATE TABLE IF NOT EXISTS public.guild_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
  donated_xp BIGINT NOT NULL DEFAULT 0,
  questions_this_week INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON public.guild_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_user ON public.guild_members(user_id);

-- 14. guild_join_requests
CREATE TABLE IF NOT EXISTS public.guild_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_guild_join_requests_guild ON public.guild_join_requests(guild_id);

-- 15. guild_chat_messages
CREATE TABLE IF NOT EXISTS public.guild_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guild_chat_messages_guild_created ON public.guild_chat_messages(guild_id, created_at DESC);

-- 16. sugoroku_progress
CREATE TABLE IF NOT EXISTS public.sugoroku_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  event_week_index INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 1 CHECK (position >= 1 AND position <= 36),
  dice_count INTEGER NOT NULL DEFAULT 0,
  lap_count INTEGER NOT NULL DEFAULT 0,
  fragments INTEGER NOT NULL DEFAULT 0,
  event_xp INTEGER NOT NULL DEFAULT 0,
  trap_guard BOOLEAN NOT NULL DEFAULT false,
  golden_dice_count INTEGER NOT NULL DEFAULT 0,
  shop_multiplier NUMERIC(4,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sugoroku_progress_week ON public.sugoroku_progress(event_week_index);

-- 17. tower_progress
CREATE TABLE IF NOT EXISTS public.tower_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  event_week_index INTEGER NOT NULL DEFAULT 0,
  current_floor INTEGER NOT NULL DEFAULT 1 CHECK (current_floor >= 1),
  floor_xp INTEGER NOT NULL DEFAULT 0,
  golden_oil_active BOOLEAN NOT NULL DEFAULT false,
  shock_mat_count INTEGER NOT NULL DEFAULT 0,
  master_key_floors_left INTEGER NOT NULL DEFAULT 0 CHECK (master_key_floors_left >= 0 AND master_key_floors_left <= 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tower_progress_week ON public.tower_progress(event_week_index);

-- 18. tower_ghosts
CREATE TABLE IF NOT EXISTS public.tower_ghosts (
  id BIGSERIAL PRIMARY KEY,
  event_week_index INTEGER NOT NULL,
  floor INTEGER NOT NULL CHECK (floor >= 1),
  xp_amount INTEGER NOT NULL DEFAULT 0 CHECK (xp_amount >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_week_index, floor)
);
CREATE INDEX IF NOT EXISTS idx_tower_ghosts_week_floor ON public.tower_ghosts(event_week_index, floor);

-- 19. stripe_chip_fulfilled
CREATE TABLE IF NOT EXISTS public.stripe_chip_fulfilled (
  stripe_session_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chips INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 20. kuji_boxes / kuji_tickets
CREATE TABLE IF NOT EXISTS public.kuji_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.kuji_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES public.kuji_boxes(id) ON DELETE CASCADE,
  prize_type TEXT NOT NULL CHECK (prize_type IN ('grand_prize', 'a', 'b_plus', 'b_minus', 'c', 'd_plus', 'd')),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 1 AND sort_order <= 200),
  drawn_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  drawn_at TIMESTAMPTZ,
  UNIQUE(box_id, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_kuji_tickets_box_drawn ON public.kuji_tickets(box_id) WHERE drawn_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_kuji_boxes_created ON public.kuji_boxes(created_at);

-- Storage buckets（既存なら更新）
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('guild-emblems', 'guild-emblems', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, name = EXCLUDED.name;

-- ========== RLS ==========
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sugoroku_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tower_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tower_ghosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_chip_fulfilled ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kuji_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kuji_tickets ENABLE ROW LEVEL SECURITY;

-- ========== Policies ==========
DROP POLICY IF EXISTS "questions_select" ON public.questions;
CREATE POLICY "questions_select" ON public.questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_logs_select" ON public.user_logs;
DROP POLICY IF EXISTS "user_logs_insert" ON public.user_logs;
CREATE POLICY "user_logs_select" ON public.user_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_logs_insert" ON public.user_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_vocabulary_all" ON public.user_vocabulary;
CREATE POLICY "user_vocabulary_all" ON public.user_vocabulary FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "runs_select_all" ON public.runs;
DROP POLICY IF EXISTS "runs_insert_own" ON public.runs;
CREATE POLICY "runs_select_all" ON public.runs FOR SELECT USING (true);
CREATE POLICY "runs_insert_own" ON public.runs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "global_vocabulary_select" ON public.global_vocabulary;
CREATE POLICY "global_vocabulary_select" ON public.global_vocabulary FOR SELECT USING (true);

DROP POLICY IF EXISTS "announcements_select_all" ON public.announcements;
CREATE POLICY "announcements_select_all" ON public.announcements FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_inventory_select_own" ON public.user_inventory;
DROP POLICY IF EXISTS "user_inventory_insert_own" ON public.user_inventory;
DROP POLICY IF EXISTS "user_inventory_update_own" ON public.user_inventory;
DROP POLICY IF EXISTS "user_inventory_delete_own" ON public.user_inventory;
CREATE POLICY "user_inventory_select_own" ON public.user_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_inventory_insert_own" ON public.user_inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_inventory_update_own" ON public.user_inventory FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_inventory_delete_own" ON public.user_inventory FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_equipment_select_own" ON public.user_equipment;
DROP POLICY IF EXISTS "user_equipment_insert_own" ON public.user_equipment;
DROP POLICY IF EXISTS "user_equipment_update_own" ON public.user_equipment;
DROP POLICY IF EXISTS "user_equipment_delete_own" ON public.user_equipment;
CREATE POLICY "user_equipment_select_own" ON public.user_equipment FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_equipment_insert_own" ON public.user_equipment FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_equipment_update_own" ON public.user_equipment FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_equipment_delete_own" ON public.user_equipment FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "exchange_snapshots_select" ON public.exchange_daily_snapshots;
CREATE POLICY "exchange_snapshots_select" ON public.exchange_daily_snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "marketplace_listings_select" ON public.marketplace_listings;
DROP POLICY IF EXISTS "marketplace_listings_insert_own" ON public.marketplace_listings;
DROP POLICY IF EXISTS "marketplace_listings_update_own" ON public.marketplace_listings;
CREATE POLICY "marketplace_listings_select" ON public.marketplace_listings FOR SELECT USING (true);
CREATE POLICY "marketplace_listings_insert_own" ON public.marketplace_listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "marketplace_listings_update_own" ON public.marketplace_listings FOR UPDATE USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "guilds_select" ON public.guilds;
DROP POLICY IF EXISTS "guilds_insert" ON public.guilds;
DROP POLICY IF EXISTS "guilds_update_leader" ON public.guilds;
DROP POLICY IF EXISTS "guilds_delete_leader" ON public.guilds;
CREATE POLICY "guilds_select" ON public.guilds FOR SELECT USING (true);
CREATE POLICY "guilds_insert" ON public.guilds FOR INSERT WITH CHECK (auth.uid() = leader_id);
CREATE POLICY "guilds_update_leader" ON public.guilds FOR UPDATE USING (auth.uid() = leader_id);
CREATE POLICY "guilds_delete_leader" ON public.guilds FOR DELETE USING (auth.uid() = leader_id);

DROP POLICY IF EXISTS "guild_members_select" ON public.guild_members;
DROP POLICY IF EXISTS "guild_members_insert" ON public.guild_members;
DROP POLICY IF EXISTS "guild_members_update_own" ON public.guild_members;
DROP POLICY IF EXISTS "guild_members_update_by_leader" ON public.guild_members;
DROP POLICY IF EXISTS "guild_members_delete_own" ON public.guild_members;
CREATE POLICY "guild_members_select" ON public.guild_members FOR SELECT USING (true);
CREATE POLICY "guild_members_insert" ON public.guild_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "guild_members_update_own" ON public.guild_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "guild_members_update_by_leader" ON public.guild_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.guild_members gm2 WHERE gm2.guild_id = guild_members.guild_id AND gm2.user_id = auth.uid() AND gm2.role = 'leader')
) WITH CHECK (true);
CREATE POLICY "guild_members_delete_own" ON public.guild_members FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "guild_join_requests_select" ON public.guild_join_requests;
DROP POLICY IF EXISTS "guild_join_requests_insert" ON public.guild_join_requests;
DROP POLICY IF EXISTS "guild_join_requests_update_by_leader_officer" ON public.guild_join_requests;
CREATE POLICY "guild_join_requests_select" ON public.guild_join_requests FOR SELECT USING (true);
CREATE POLICY "guild_join_requests_insert" ON public.guild_join_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "guild_join_requests_update_by_leader_officer" ON public.guild_join_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_join_requests.guild_id AND gm.user_id = auth.uid() AND gm.role IN ('leader', 'officer'))
) WITH CHECK (true);

DROP POLICY IF EXISTS "guild_chat_messages_select_member" ON public.guild_chat_messages;
DROP POLICY IF EXISTS "guild_chat_messages_insert_member" ON public.guild_chat_messages;
CREATE POLICY "guild_chat_messages_select_member" ON public.guild_chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_chat_messages.guild_id AND gm.user_id = auth.uid())
);
CREATE POLICY "guild_chat_messages_insert_member" ON public.guild_chat_messages FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_chat_messages.guild_id AND gm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "sugoroku_select_own" ON public.sugoroku_progress;
DROP POLICY IF EXISTS "sugoroku_insert_own" ON public.sugoroku_progress;
DROP POLICY IF EXISTS "sugoroku_update_own" ON public.sugoroku_progress;
CREATE POLICY "sugoroku_select_own" ON public.sugoroku_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sugoroku_insert_own" ON public.sugoroku_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sugoroku_update_own" ON public.sugoroku_progress FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tower_select_own" ON public.tower_progress;
DROP POLICY IF EXISTS "tower_insert_own" ON public.tower_progress;
DROP POLICY IF EXISTS "tower_update_own" ON public.tower_progress;
CREATE POLICY "tower_select_own" ON public.tower_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tower_insert_own" ON public.tower_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tower_update_own" ON public.tower_progress FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tower_ghosts_select" ON public.tower_ghosts;
DROP POLICY IF EXISTS "tower_ghosts_insert" ON public.tower_ghosts;
DROP POLICY IF EXISTS "tower_ghosts_update" ON public.tower_ghosts;
CREATE POLICY "tower_ghosts_select" ON public.tower_ghosts FOR SELECT USING (true);
CREATE POLICY "tower_ghosts_insert" ON public.tower_ghosts FOR INSERT WITH CHECK (true);
CREATE POLICY "tower_ghosts_update" ON public.tower_ghosts FOR UPDATE USING (true);

DROP POLICY IF EXISTS "kuji_boxes_select_all" ON public.kuji_boxes;
CREATE POLICY "kuji_boxes_select_all" ON public.kuji_boxes FOR SELECT USING (true);
DROP POLICY IF EXISTS "kuji_tickets_select_all" ON public.kuji_tickets;
DROP POLICY IF EXISTS "kuji_tickets_update_draw" ON public.kuji_tickets;
CREATE POLICY "kuji_tickets_select_all" ON public.kuji_tickets FOR SELECT USING (true);
CREATE POLICY "kuji_tickets_update_draw" ON public.kuji_tickets FOR UPDATE USING (drawn_by IS NULL) WITH CHECK (drawn_by = auth.uid() AND drawn_at IS NOT NULL);

-- Storage policies
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_select_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "guild_emblems_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "guild_emblems_select_public" ON storage.objects;
CREATE POLICY "guild_emblems_insert_authenticated" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'guild-emblems');
CREATE POLICY "guild_emblems_select_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'guild-emblems');

-- 1番くじ: 新規箱作成関数
CREATE OR REPLACE FUNCTION public.create_ichiban_box()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_box_id UUID;
BEGIN
  INSERT INTO public.kuji_boxes (id) VALUES (gen_random_uuid()) RETURNING id INTO new_box_id;
  INSERT INTO public.kuji_tickets (box_id, prize_type, sort_order)
  SELECT new_box_id, prize_type, row_number() OVER ()
  FROM (
    SELECT prize_type FROM (
      SELECT 'grand_prize' AS prize_type FROM generate_series(1, 2)
      UNION ALL SELECT 'a' FROM generate_series(1, 4)
      UNION ALL SELECT 'b_plus' FROM generate_series(1, 5)
      UNION ALL SELECT 'b_minus' FROM generate_series(1, 5)
      UNION ALL SELECT 'c' FROM generate_series(1, 24)
      UNION ALL SELECT 'd_plus' FROM generate_series(1, 80)
      UNION ALL SELECT 'd' FROM generate_series(1, 80)
    ) t ORDER BY random()
  ) shuffled;
  RETURN new_box_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_ichiban_box() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ichiban_box() TO anon;
