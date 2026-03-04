-- アイテム廃止に伴い、全ユーザーの所持アイテムを削除する（ルーレットは装備のみ排出）
DELETE FROM public.user_inventory;
