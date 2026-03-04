-- 英単語出題を data/ の Excel 由来の default-vocab.json に統一するため、
-- 管理者追加の global_vocabulary を空にする。
-- 実行後は /api/vocab-default は default-vocab.json のみを返す。
TRUNCATE TABLE public.global_vocabulary;
