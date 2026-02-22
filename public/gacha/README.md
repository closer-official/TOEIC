# ガチャアイテム画像の配置

このフォルダに、ガチャアイテムのイラスト画像を配置してください。

## ファイル名の規則

**`{アイテムID}.png`**

アイテムIDは `src/lib/gacha-items.ts` の各アイテムの `id` フィールドと一致させてください。

## 配置する画像一覧

| ファイル名 | アイテム名 |
|-----------|-----------|
| coin.png | 幸運のコイン |
| bookmark.png | 単語の栞 |
| eraser.png | 小さな消しゴム |
| nib.png | 予備のペン先 |
| workbook.png | 練習問題集 |
| book.png | 知識の書 |
| shield.png | 守りの盾 |
| grammar_reminder.png | 文法リマインダー |
| word_memo.png | 単語速記帳 |
| glasses.png | 集中メガネ |
| clip.png | 銀のクリップ |
| alarm.png | ミニ目覚まし時計 |
| sword.png | 諸刃の剣 |
| potion.png | 回復の秘薬 |
| golden_pen.png | 黄金の羽ペン |
| hourglass.png | 時間の砂時計 |
| combo_statue.png | コンボの女神像 |
| black_ink.png | 漆黒のインク |
| steel_dict.png | 鋼の辞書 |
| philosopher_stone.png | 賢者の石 |
| chronos_clock.png | クロノスの時計 |
| medal.png | 覇者のメダル |
| shun_secret.png | 瞬の極意 |
| phoenix_feather.png | 不死鳥の羽根 |
| crown.png | 知恵の王冠 |

## 推奨仕様

- 形式: PNG（透過可）
- サイズ: 256×256 px 以上（表示時に自動リサイズされます）
- アスペクト比: 1:1 を推奨

## 配置後

画像を配置すると、獲得済みのアイテムの図鑑ページで表示されます。
未配置の場合は「?」プレースホルダーが表示されます。
