# 運命のすごろく — UX・世界観の方向性

## 現状の課題
- 裏側のロジック（マス番号・数値）がそのまま見えている
- 「イベントXP」が何か（＝全共通XP）伝わりにくい
- 効果メッセージがシステムログ的で、イベントの「物語」感が弱い

## 目指す方向

### 1. 見せる情報を整理
- **ユーザーに伝えるもの**: すごろくの**枡目（盤面）**・**サイコロ**・**周回数**
- 数値は必要最小限にし、枡目の名前やイベントの雰囲気を前面に

### 2. 効果をRPG風会話で
- 止まったマスや通過時の効果を、**ポップアップ**または**画面下の会話ウィンドウ**で表示
- 例: 「グランドエントランスを通過した。+500 全共通XP を手に入れた。」「ネオン・エリアに止まった。光がきらめき、+320 全共通XP と 8 チップを獲得！」
- システム的な文言（「出目: 3 → ダイス＆チップ」）より、短い物語調の一文にする

### 3. 用語の統一
- **イベントXP ＝ 全共通XP** と明記（画面の説明文・換金表記・会話文すべてで統一）

### 4. 盤面をイラストで
- 36マスを**1枚のイラスト**（写真風・絵柄）で表現
- コマ（プレイヤー位置）をそのイラストの上で移動させる形式
- マスごとに名前・雰囲気が視覚で分かると、RPG会話と相性が良い

### 5. 枡目の効果の「ばらけ」
- 現状、同名枡が続く（ネオン・エリア×4、ストレート・ロード×6、ラグジュアリー×8、ギャンブル・ゾーン×8など）ため、一覧で見ると効果がばらけていない印象になりやすい。
- **イラスト生成時**は、**枡番号と効果を細かく指定**し、同じ種類でも「2番はネオン入口」「5番はネオン終わりで地獄へ」のようにテイストを分けると、視覚的に差がつく。
- 詳細な「枡番号・効果・テイスト」一覧とプロンプト例は **[SUGOROKU-BOARD-ILLUSTRATION-PROMPT.md](./SUGOROKU-BOARD-ILLUSTRATION-PROMPT.md)** を参照。

---

## すごろく盤面イラスト用・画像生成プロンプト案

以下は、36マスがひと目で分かる「運命のすごろく」の盤面イラスト用プロンプト案です。  
**正方形（1:1）または横長（4:3）**で、アプリでは端でトリミングやスクロールで使う想定です。

---

### 案1（ダーク・ゴールド・ボードゲーム風）
```
Single illustrated game board for a 36-space sugoroku (Japanese board game). Dark fantasy style. The path is a continuous track of 36 distinct squares winding in a spiral or snake shape. Each square has a subtle different tone (some golden, some deep purple, some neon). Key squares suggest: grand entrance (start), neon district, hell slippery, dice and gems, casino buffet, straight road, dealer shop, eternal altar, black hole, luxury zone, trap guard rest, gambling zone. Matte painting style, rich gold and black, no text on the board. Top-down or isometric view. One empty token space to show where the player piece goes.
```

（意訳: 36マスのすごろくボード1枚。ダークファンタジー。マスは螺旋または蛇型に続き、各マスはゴールド・深紫・ネオンなどで区別。グランドエントランス・ネオン・地獄・ダイス＆チップ・ビュッフェ・ストレート・ショップ・エターナル・ブラックホール・ラグジュアリー・用心棒・ギャンブルなどを雰囲気で表現。マットペイント風、ゴールドと黒、文字なし。俯瞰またはアイソメ。コマ用の空き1マス。）

---

### 案2（和モダン・写真風質感）
```
Japanese sugoroku board game illustration, 36 spaces in a single winding path. Style: modern washi and gold leaf aesthetic, dark navy and gold, photorealistic texture. Squares feel like lacquered tiles or paper with subtle patterns. The path flows like a journey: entrance, neon area, hazard zone, gift squares, shop, altar, black hole, luxury section, rest area, gamble zone. No numbers or text. Isometric or top-down. Warm lighting. One space left empty for game piece.
```

（意訳: 36マスすごろく、1本の道。和モダン・金箔・ダークネイビーとゴールド、写実的な質感。マスは漆塗りや和紙の雰囲気。入口・ネオン・危険地帯・報酬・ショップ・祭壇・ブラックホール・ラグジュアリー・休息・ギャンブルをイメージ。数字・テキストなし。アイソメまたは俯瞰。温かい光。コマ用に1マス空き。）

---

### 案3（ネオン・カジノ・1枚絵）
```
One continuous game board for sugoroku, 36 spaces, single image. Neon noir / casino aesthetic. The track is a glowing path through different zones: grand entrance (bright), neon strip, slippery hazard (dark red), dice and gems (gold), buffet, long straight, dealer shop (central), eternal altar (glowing), black hole (void), luxury (purple and gold), guard rest, gambling (dice and cards). Dark background, cyan and gold and purple neon. Top-down view. No text. Empty circle on one space for player token.
```

（意訳: 36マスすごろくの連続ボード1枚。ネオンノワール・カジノ風。ゾーンごとに光る道: エントランス・ネオンストリップ・スリッパリー・ダイス＆チップ・ビュッフェ・ストレート・ショップ・エターナル・ブラックホール・ラグジュアリー・休息・ギャンブル。暗い背景にシアン・ゴールド・紫のネオン。俯瞰。文字なし。コマ用に1マスを円で空ける。）

---

## 実装の優先度（案）
1. **用語**: 画面全体で「イベントXP＝全共通XP」と表記（即時）
2. **会話エリア**: ロール結果・マス効果を画面下のRPG風会話枠で表示（短期）
3. **盤面イラスト**: 上記プロンプトで画像を生成し、背景または盤面として配置（中期）
4. **コマ移動**: イラスト上の現在マスにコマを表示（中期）
