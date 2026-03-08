# オフライン対応 仕様書

## 概要

- 単語モード・Part 5 の両方をオフラインでプレイ可能にする。
- 問題データは**初回起動時にすべてダウンロード**。運営が追加した分は**次回起動時にダウンロード**（そのときはスキップ可、初回はスキップ不可）。
- スタミナは**時間経過でオフラインでも増加**。チップによる回復は**オンライン時のみ**。
- オフライン中のプレイ結果はローカルにキューし、オンライン復帰時に**自動＋手動**で同期。

---

## 1. データのダウンロード

### 1.1 初回起動時（スキップ不可）

- **単語リスト**: `/api/vocab-default` 相当の全件を取得し、IndexedDB に保存。
- **Part 5**: オフライン用に必要な全問題を取得する API を用意し、全件取得して IndexedDB に保存。
- ダウンロード完了までゲーム開始を許可しない（進捗表示＋「初回のためスキップできません」）。

### 1.2 2回目以降の起動時（更新あり・スキップ可）

- 起動時に「新しい問題があります」を検知（例: サーバーがバージョン or 件数を返す）。
- 更新がある場合のみダウンロード開始。このときは**スキップ可能**（スキップした場合は前回キャッシュのまま。オンライン時は従来どおり API から都度取得も可とするかは別途）。
- スキップしない場合はダウンロード完了後にキャッシュを上書き。

### 1.3 キャッシュのキー・バージョン

- 単語: `vocab_default` + サーバーから返す `version` または `updatedAt`（あれば）。比較用にメタ情報を保存。
- Part 5: `part5_offline` + 同様にバージョン。更新検知は「GET で version/count だけ返す」エンドポイントでも可。

---

## 2. スタミナ

### 2.1 オフラインでの時間経過回復

- オンライン時に `GET /api/stamina` で取得した `stamina_count`, `last_stamina_at` および上限・回復ルール（`subscription_tier`, `recoverySpeedMultiplier` 等）をローカルに保存。
- オフライン中は `computeCurrentStamina` と同一ロジックで、保存した値＋経過時間から現在スタミナを計算し表示・消費判定に使用。
- チップによる回復は**オンライン時のみ**（オフラインではチップ使用 UI を無効化するか、使用不可であることを表示）。

### 2.2 同期時のスタミナ

- オフライン中に消費したスタミナは「未送信 run の staminaAmount の合計」としてローカルで管理。
- 同期 API 内で、run を古い順に処理するたびにスタミナを消費。スタミナ不足で送れない run はキューに残し、次回オンライン時に再送。

---

## 3. 同期

### 3.1 自動・手動

- **自動**: `navigator.onLine` および自サーバーへの軽い ping でオンライン復帰を検知し、未送信キューを送信。
- **手動**: 画面上に「未送信 N 件」「今すぐ送信」ボタンを表示し、押下で送信。

### 3.2 重複防止（冪等）

- 各オフライン run にクライアント発行の一意 ID（UUID）を持たせる。
- サーバーは同一 ID を再受信した場合は「処理済み」として 200 でスキップし、結果に「already_synced」等を含めてもよい。クライアントは送信成功した ID をキューから削除。

### 3.3 同期 API

- **エンドポイント**: `POST /api/runs/offline-sync`
- **body**: `{ runs: Array<{ id, score, totalTimeMs, game_mode, staminaAmount, question_ids?, evolutionPayload? }> }`
- **処理**: 各 run を順に「スタミナ消費 → runs 登録 → evolution」を実行。スタミナ不足で止まったら、処理できた分までを 200 で返し、`processedIds` と `insufficientStaminaFromId` のような形で返す。クライアントは `processedIds` をキューから削除し、残りは次回に再送。

---

## 4. 未送信 run の保存形式（ローカル）

- 各要素: `id`（UUID）, `score`, `totalTimeMs`, `game_mode`, `staminaAmount`, `question_ids`（Part 5 用）, `scoreToShow`, `epMult` 等 evolution に必要な payload, `createdAt`（送信順の保証用）。
- IndexedDB のストア名は例: `offline_pending_runs`。

---

## 5. Part 5 の「全件」の範囲

- オフライン用として、運営が管理する Part 5 問題を「オフライン用セット」としてまとめて返す API を用意する。
- 例: `GET /api/questions/offline-bundle?version=1` で全問返す。または既存の `GET /api/questions` に `limit=2000` 等で全件取得できるようにする。初回ダウンロード時はその全件をキャッシュする。

---

## 6. 実装時の参照

- スタミナ計算: `src/lib/stamina.ts` の `computeCurrentStamina` をクライアントでも使用可能に（既にロジックは純粋関数）。
- 単語取得: `src/app/api/vocab-default/route.ts`。
- Part 5 取得: `src/app/api/questions/route.ts`（静的 + DB）。オフライン用は静的＋DB の全件を返す新エンドポイントでも可。
- Run 登録: `src/app/api/runs/route.ts`。
- Evolution: `src/app/api/evolution/route.ts`。
- ゲーム開始・結果送信: `src/app/game/page.tsx` の `loadQueue` およびゲーム終了時の POST。

---

## 7. チェックリスト（実装時）

- [ ] IndexedDB: vocab キャッシュ・part5 キャッシュ・pending runs キュー・スタミナメタのスキーマ定義。
- [ ] 初回起動: 単語＋Part 5 の全件ダウンロード UI（スキップ不可）、進捗表示。
- [ ] 2回目以降: 更新検知、ダウンロード開始、スキップ可能 UI。
- [ ] オフライン検知とスタミナ表示（時間経過計算）、チップはオフラインで無効 or 非表示。
- [ ] ゲーム開始: オフライン時はキャッシュから問題を読み、スタミナはローカル計算で消費判定。
- [ ] ゲーム終了: オフライン時は run をキューに追加。オンライン時は従来どおり即送信。
- [ ] `POST /api/runs/offline-sync`: 冪等・スタミナ不足時の部分成功レスポンス。
- [ ] オンライン復帰: 自動送信＋「未送信 N 件」「今すぐ送信」ボタン。
