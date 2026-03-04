# スコア・XP に関与する全効果 一覧（数値仕様）

装備・アイテム・進化・ギルド・モードなど、スコアおよび獲得XPに影響する要素を、計算式と数値まで含めてまとめたものです。

---

## 1. 基礎定数（ゲーム共通）

| 定数 | 値 | 出典 |
|------|-----|------|
| 正解時の時間加算（ベース） | 2 秒 | `survival.ts` CORRECT_ADD_SEC |
| 誤答時の時間減算（ベース） | 5 秒 | `survival.ts` WRONG_PENALTY_SEC |
| 5コンボごとの時間ボーナス | 3 秒 | COMBO_BONUS_SEC, COMBO_BONUS_INTERVAL=5 |
| レアリティ別基礎点（BP） | COMMON 1000, UNCOMMON 1200, RARE 1500, EPIC 2000, LEGENDARY 3000 | `shun-score.ts` RARITY_BASE_POINTS |
| 難易度→レアリティ | 500→COMMON, 700→UNCOMMON, 900→RARE | rarityFromDifficulty() |
| コンボ倍率 | 1 + combo/10（10コンボで2倍、50で6倍） | comboMultiplier(combo) |
| スピードボーナス | 1 + (残り時間率 × 0.5)。即答で最大1.5倍 | speedBonus(remainingRate) |
| 基礎XP率（最終表示スコアに対する） | 0.03（3%） | baseXp = scoreToShow * 0.03 |
| モード別XP倍率 | Part5全国 3倍 / その他 1倍 | xpMultiplier |

---

## 2. 進化（研鑽の極意・至高の技巧・魂の燃焼・ギルド研究所）

### 2.1 研鑽の極意（correct_time）

- **効果**: 正解時の「残り時間加算」倍率。
- **計算式**: `1 + seasonCarry + 0.01 × level`
- **レベル**: 0〜10（シーズン分岐）。前シーズンLv.10なら seasonCarry = 0.01。
- **適用箇所**: 正解時の時間加算（CORRECT_ADD_SEC × この倍率）、**獲得XP**（後述の correctTimeMult として乗算）。

### 2.2 至高の技巧（score）

- **効果**: 1問あたりのスコア倍率。
- **計算式**: `1 + seasonCarry + 0.01 × level`
- **レベル**: 0〜10。前シーズンLv.10なら seasonCarry = 0.01。
- **適用箇所**: 基礎スコアの baseAdd に乗算（コンボ・スピード・BP の後）。

### 2.3 魂の燃焼（wrong_penalty）

- **効果**: ゲーム内の誤答ペナルティ秒数には未使用（常に 1.0 倍）。スタミナ回復短縮など別用途。
- **計算式**: `wrongPenaltyMultiplier(level, seasonCarry)` → 常に 1。

### 2.4 ギルド研究所（スコア）

- **効果**: スコア加算率（研究所の「スコア」Lv）。
- **計算式**: `guildScoreBonus = 0.01 × lab_score_lv`（Lv1で1%、Lv10で10%）。
- **適用箇所**: 基礎スコアに `(1 + guildScoreBonus)` を乗算。

---

## 3. 装備（スコア・XP・時間に効くもの）

装備の実効値は **effectInitialValue × equipmentEffectMultiplier(grade, level, effect_base)** で算出。  
`equipmentEffectMultiplier = effect_base + perLevel × level`。  
`perLevel` = グレード係数（コモン 0.001, ノーマル 0.002, レア 0.003, エピック 0.004, レジェンダリー 0.005, エターナル 0.006）。

### 3.1 スコアに直接効く装備

| 装備名 | effectKey | 初期値 | 定数 | 効果内容（数値） |
|--------|-----------|--------|------|------------------|
| 黄金のシーリングスタンプ | score_add_rate | 0.10 (10%) | — | 全正解の基礎スコアに (1 + 値) を乗算。値は%扱いなので 0.10 = 10% 増。 |
| 連鎖の万年筆 | combo_bonus_multiplier | 5.0 | 10 | 10コンボ到達**直後の次の1問のみ**スコア・XPが「値」倍。 |
| 栄光のタキシード | glory_stack_per_10 | 50 | 10 | 10問正解ごとにスタック+1（最大10）。1問あたりスコア = (baseAdd + **値×スタック数**) の形で加算。 |
| 鉄火場のシルクシャツ | tekka_buff_rate | 0.20 (20%) | 0.50 | 正解時スコアに (1 + 値) を乗算。不正解時 50% で即ゲームオーバー。 |
| 運命の羽ペン | fate_heaven_multiplier | 3.0 | -3 | 正解時 50% でスコアが「値」倍、50% で (baseAdd+gloryBonus)×3 を**マイナス**。 |
| 追撃のヒール | evolution_buff_multiplier | 1.5 | 30 | ゲーム開始**30秒間**、獲得スコアとXPが「値」倍。 |
| 繁栄のローファー | final_bonus_coefficient | 100.0 | — | プレイ終了時に **正解数 × 値** を瞬スコアに加算（後述の「最終スコア」の前）。 |
| 飛躍のトラックスパイク | speed_multiplier_super | 2.0 | 0.6 | 応答 1.5秒以内でスコア「値」倍、3秒以内で「値×0.6」倍。 |

### 3.2 XP に直接効く装備

| 装備名 | effectKey | 初期値 | 定数 | 効果内容（数値） |
|--------|-----------|--------|------|------------------|
| 熟練の蛍光マーカー | xp_add_rate | 0.15 (15%) | — | 1問あたりスコアに (1 + 値) を乗算するため、瞬スコアが増え、scoreToShow → baseXp が増加し、**結果として獲得XPも増える**（最終XP式の ep_pct とは別系統）。 |
| 成長のドレス | growth_ex_per_10 | 0.05 | 10 | 10問正解ごとにスタック+1（最大10）。1問あたりスコアに (1 + 値×スタック数) を乗算。※スコア経由でXPにも効く。 |
| 英知のヘッドセット | minute_bonus_coefficient | 10.0 | 60 | 60秒経過ごとに「その1分間の正解数 × 値」を**スコア**に加算（XPは最終スコアから算出されるため間接的に増加）。 |

※実装上の注意: スコア計算式で `(1 + (e.xp_add_rate ?? 0))` と `(1 + (e.growth_ex_per_10 ?? 0) * growthStacksRef.current)` が乗算されているため、これらは「瞬スコア」を増やし、その結果 scoreToShow と baseXp が増える形でXPに効く。一方、**最終XP**は `baseXp * epMult * xpMultiplier * correctTimeMult` で、ep_pct はアイテムのみ。

### 3.3 時間・コンボ（スコアに間接影響）

| 装備名 | effectKey | 初期値 | 定数 | 効果内容（数値） |
|--------|-----------|--------|------|------------------|
| 学者の角帽 | combo_resume_multiplier | 1.1 | — | コンボ切れ時、倍率が 1.0 ではなく「値」から再スタート。 |
| 逆境のモノクル | reversal_recovery_multiplier | 3.0 | 10 | 残り**10秒以下**の正解時、時間回復量が「値」倍。 |
| 延命の修正テープ | recovery_sec_per_5 | 2.0 | 5 | 累計5問正解ごとに残り時間 +「値」秒。 |
| 洞察のサンバイザー | periodic_add_sec | 5.0 | 60 | 60秒ごとに残り時間 +「値」秒。 |
| 預言者のバンダナ | prophecy_multiplier | 2.0 | 0.5 | 60秒ごとに 50% で残り時間「値」倍、50% で 0.5倍。 |
| 土俵際のブレザー | last_stand_sec | 3.0 | — | 0秒到達時1回だけ時間を「値」秒停止。 |
| 悠久のトレンチコート | time_decay_rate | 0.90 | — | 時間減少速度を「値」倍（下限0.5）。 |
| 維持のコンプレッションソックス | auto_recovery_sec | 3.0 | 15 | 15秒ごとに残り時間 +「値」秒。 |
| 韋駄天の下駄 | idaten_add_sec | 30.0 | 30 | 60秒ごとに 50% で残り時間 +「値」秒、50% で 30秒減。 |

---

## 4. アイテム（所持で効く・加算は合計・倍率は最大）

### 4.1 スコアに効くアイテム

| アイテム名 | 効果キー | 数値 | 効果内容（数値） |
|------------|----------|------|------------------|
| 単語の栞 | （final_score_pct 廃止） | - | 表示・計算から削除済み。 |
| 知識の書 | （final_score_pct 廃止） | - | 同上。 |
| 黄金の羽ペン | （final_score_pct 廃止） | - | 同上。 |
| 賢者の石 | （final_score_pct 廃止） | - | 同上。 |
| 瞬の極意 | combo_bonus_add | 0.05 | コンボ倍率に +0.05 加算（final_score_pct は廃止）。 |
| 幸運のコイン | bp_luck_chance, bp_luck_mult | 0.10, 1.2 | 10% でその問のBPが 1.2倍。 |
| 文法リマインダー | bp_part5_pct | 10 | Part5モードのみ BP +10%。 |
| 単語速記帳 | bp_vocab_pct | 10 | 単語全国モードのみ BP +10%。 |
| 予備のペン先 | combo_bonus_add | 0.01 | コンボ倍率に +0.01 加算。 |
| 集中メガネ | speed_bonus_add | 0.05 | スピードボーナス倍率に +0.05 加算。 |
| 銀のクリップ | combo50_score_pct | 5 | 50コンボ以上でスコア +5%。 |
| 諸刃の剣 | correct_score_mult, miss_penalty_mult | 1.5, 1.5 | 正解スコア 1.5倍、ミス時ペナルティ 1.5倍。 |
| 漆黒のインク | correct_score_mult, miss_penalty_mult | 1.7, 2 | 正解スコア 1.7倍、ミス時ペナルティ 2倍。 |
| 知恵の王冠 | crown_all_rare | 1 | 全問を RARE（1500 BP）扱い。 |

### 4.2 XP（EP）に効くアイテム

| アイテム名 | 効果キー | 数値 | 効果内容（数値） |
|------------|----------|------|------------------|
| 練習問題集 | ep_pct | 5 | 獲得EP（XP） +5%。epMult = 1 + ep_pct/100。 |
| 覇者のメダル | ep_pct | 50 | 獲得EP +50%。 |

### 4.3 時間・ペナルティ（スコア・生存に間接影響）

| アイテム名 | 効果キー | 数値 | 効果内容（数値） |
|------------|----------|------|------------------|
| 小さな消しゴム | miss_penalty_reduce_pct | 5 | ミス時の時間減算を 5% 軽減。 |
| 守りの盾 | miss_penalty_reduce_pct | 10 | 10% 軽減。 |
| 鋼の辞書 | miss_penalty_reduce_pct | 25 | 25% 軽減。 |
| クロノスの時計 | correct_time_mult | 1.2 | 正解時の時間回復量 1.2倍。 |
| ミニ目覚まし時計 | initial_time_add_sec | 2 | 開始時残り時間 +2秒。 |
| 時間の砂時計 | initial_time_add_sec | 5 | +5秒。 |

---

## 5. スコア計算の順序（1問正解時・全国サバイバル）

1. **BP**: 難易度→レアリティの基礎点。知恵の王冠なら RARE(1500)。幸運のコインで一定確率 1.2倍。Part5/単語モード用アイテムで BP 増。
2. **effectiveComboMult**: コンボ0かつ学者の角帽ありなら combo_resume_multiplier、否则 comboMultiplier(combo)。ここにアイテム combo_bonus_add を加算。
3. **speedBonusVal**: speedBonus(remainingRate) + アイテム speed_bonus_add。
4. **baseAdd** = ceil(BP × effectiveComboMult × speedBonusVal) × **scoreMultiplier(進化)** × (1 + **guildScoreBonus**)。
5. 連鎖の万年筆（10コンボ直後1問）なら baseAdd × **combo_bonus_multiplier**。
6. **gloryBonus** = glory_stack_per_10 × gloryStacks（栄光のタキシード）。
7. **add** = (baseAdd + gloryBonus) × (1 + **score_add_rate**) × (1 + **xp_add_rate**) × (1 + **growth_ex_per_10** × growthStacks)。
8. アイテム correct_score_mult を乗算。
9. 50コンボ以上かつ combo50_score_pct ありなら add × (1 + combo50_score_pct/100)。
10. 運命の羽ペン: 50% で add × fate_heaven_multiplier、50% で add = -3×(baseAdd+gloryBonus)。
11. 追撃のヒール（開始30秒以内）なら add × evolution_buff_multiplier。
12. 飛躍のトラックスパイク: 応答1.5秒以内で add × speed_multiplier_super、3秒以内で × (speed_multiplier_super × 0.6)。
13. 鉄火場のシルクシャツなら add × (1 + tekka_buff_rate)。
14. **round(add)** を瞬スコアに加算。
15. 英知のヘッドセット: 60秒区切りで「その1分の正解数 × minute_bonus_coefficient」をスコアに加算。

**最終表示スコア**  
`scoreToShow = round(瞬スコア + final_bonus_coefficient × 正解数)`  
（アイテムの final_score_pct 倍率は廃止済み。）

---

## 6. 獲得XPの計算式

- **baseXp** = scoreToShow × **0.03**
- **epMult** = 1 + (アイテム ep_pct 合計)/100
- **xpMultiplier** = モードが Part5全国なら 3、否则 1
- **correctTimeMult** = correctTimeMultiplier(進化 correct_time, seasonCarry)

**獲得XP** = floor(baseXp × epMult × xpMultiplier × correctTimeMult)

※装備の xp_add_rate / growth_ex_per_10 は、瞬スコアを増やすことで scoreToShow → baseXp を増やし、間接的にXPを増やす。直接「XP倍率」として掛かるのは ep_pct（アイテム）と correctTimeMult（進化）と xpMultiplier（モード）。

---

## 7. 装備効果値の算出（実数値）

装備の表示・適用値 = **effectInitialValue × equipmentEffectMultiplier(grade, level, effect_base)**

- **equipmentEffectMultiplier** = effect_base + perLevel × level  
- **perLevel**: コモン 0.001, ノーマル 0.002, レア 0.003, エピック 0.004, レジェンダリー 0.005, エターナル 0.006  
- 進化でグレードアップすると level は 0 になり、effect_base に前グレード時点の倍率が引き継がれる。

例: 黄金のシーリングスタンプ ノーマル Lv.8, effect_base=1.005  
→ 倍率 = 1.005 + 0.002×8 = 1.021  
→ 効果値 = 0.10 × 1.021 = 0.1021 → スコア (1+0.1021) 倍。

---

## 8. 結果画面の装備説明（20種）の実装

プレイ終了後・解説画面で「装着装備（4部位）・ビフォアアフター・今回もたらしたこと」に表示する文言は、`src/app/game/page.tsx` の **`buildEquipmentActionSummary(effectKey, playStats, contributionPt, runContext)`** で、`effectKey` ごとに次のように生成しています。プレイ中に `equipmentPlayStatsRef` へ記録した発動回数・累計値（`playStats`）と、必要に応じて `runContext`（正解数・プレイ時間・基礎スコア・スコア加算率による増分・開始時バフによる増分）を使って説明文を組み立てます。

| effectKey | 装備例 | 表示内容の決め方 |
|-----------|--------|------------------|
| `recovery_sec_per_5` | 延命の修正テープ | 発動した延長時間（秒）。runContext ありなら「プレイ時間 約○分 のため 5秒ごとに発動 → 時間を +X秒 延長」 |
| `score_add_rate` | 黄金のシーリングスタンプ | runContext ありかつ増分>0 なら「加算率なしの場合 基礎スコア X → 適用後 Y（+Z pt 増加）」；なければ「全正解のスコアに加算率を適用」 |
| `xp_add_rate` | 熟練の蛍光マーカー | 「獲得XPに加算率を適用」 |
| `minute_bonus_coefficient` | 英知のヘッドセット | 1分区切りボーナス発動回数と、加算 pt。「→ 基礎スコアに +X pt 加算（最終スコア算出前に反映）」 |
| `combo_bonus_multiplier` | 連鎖の万年筆 | 「10コンボ到達後の次の1問で倍率を N 回発動」 |
| `reversal_recovery_multiplier` | 逆転のモノクル | 「残り10秒以下で回復倍率を N 回適用」 |
| `combo_resume_multiplier` | 連鎖の万年筆（コンボ維持） | 「コンボ途切れ時の倍率維持を N 回適用」 |
| `periodic_add_sec` | 洞察のサンバイザー等 | 60秒ごとの延長秒数。runContext ありなら「プレイ時間 X秒（約Y分）のため 60秒ごとに発動 → 時間を +Z秒 延長」 |
| `prophecy_multiplier` | デルポイの託宣所 | 天国/地獄の発動回数。runContext ありなら「プレイ時間 約○分 のため 60秒ごとに判定 → 預言 天国N回・地獄M回 発動」 |
| `last_stand_sec` | 土俵際のブレザー | 時間停止使用秒数。runContext ありなら「プレイ時間 約○分 で残り0秒付近に到達 → 土俵際で時間停止を X秒 使用」 |
| `glory_stack_per_10` | 栄光のタキシード | 「栄光スタックを最大 N まで蓄積」 |
| `growth_ex_per_10` | 成長のドレス | runContext ありなら「正解数 N → 10問ごとスタック最大 M」または「10問に満たずスタック0」；なければ従来の蓄積文言 |
| `evolution_buff_multiplier` | 追撃のヒール | 開始時バフをかけた問題数。runContext ありかつ増分>0 なら「開始時バフを M 問に適用 → そのM問分のスコア増分 +X pt（基礎スコアに含まれる…）」 |
| `final_bonus_coefficient` | 繁栄のローファー | contributionPt で「スコアに +X pt 寄与」 |
| `fate_heaven_multiplier` | 運命の羽ペン | 「運命を 天国N回・地獄M回 発動」 |
| `speed_multiplier_super` | 韋駄天のドレスシューズ | 「スピードボーナスを スーパーN回・ファストM回 発動」 |
| `tekka_buff_rate` | 鉄火のブレス | 「正解時の鉄火バフを N 回適用」 |
| `auto_recovery_sec` | 維持のソックス | 15秒ごとの延長秒数。runContext ありなら「プレイ時間 約○分 のため 15秒ごとに発動 → 時間を +X秒 延長」 |
| `idaten_add_sec` | 韋駄天のドレスシューズ（時間） | 延長/減少秒数と回数。runContext ありなら「プレイ時間 約○分 のため 60秒ごとに判定」＋「時間を +X秒 延長」「時間を -Y秒 減少（Z回）」 |
| `time_decay_rate` | （減衰系） | 「残り時間の減少量に影響」 |
| 上記以外 | — | 説明行なし（default）。「今回のプレイでは数値化できる発動なし（基礎スコア・XPに反映）」と表示される |

- **未装備スロット**: 「未装備のため変動なし」と表示。
- **発動が一度もない場合**: その effectKey 用の `if` に入らず `lines` が空になり、一括で「数値化できる発動なし」と表示されます。

---

## 9. 参照ファイル一覧

| 内容 | ファイル |
|------|----------|
| 基礎点・コンボ・スピード | `src/lib/shun-score.ts` |
| 時間定数 | `src/lib/survival.ts` |
| 進化倍率 | `src/lib/evolution.ts` |
| 装備定義・倍率 | `src/lib/equipment-items.ts` |
| 装備効果集約 | `src/lib/equipment-effects.ts` |
| アイテム定義 | `src/lib/gacha-items.ts` |
| アイテム効果集約 | `src/lib/item-effects.ts` |
| スコア・XP計算の適用 | `src/app/game/page.tsx` |
| ギルド研究所ボーナス | `src/app/api/evolution/route.ts` |

---

以上が、スコア・XPに関与する装備・アイテム・進化・研究所・モードの効果を、数値と計算順まで含めた一覧です。
