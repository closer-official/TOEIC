-- 参加申請の承認時、リーダー・幹部が「他人」を guild_members に追加できるようにする
-- 従来: INSERT は auth.uid() = user_id のみ許可 → 承認者が挿入すると user_id が申請者で RLS 違反
DROP POLICY IF EXISTS "guild_members_insert" ON public.guild_members;
CREATE POLICY "guild_members_insert" ON public.guild_members FOR INSERT WITH CHECK (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.guild_members gm
    WHERE gm.guild_id = guild_members.guild_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('leader', 'officer')
  )
);
