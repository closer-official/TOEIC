/**
 * 週替わりイベント（8種類を順番にローテーション）
 * 基準: 第0週＝運命のすごろくから開始（EPOCH_UTC_MSの月曜 0:00 JST）。週番号で eventIndex = weekIndex % 8
 */

export type WeeklyEventId =
  | 'sugoroku'
  | 'tower'
  | 'ichiban'
  | 'bingo'
  | 'treasure'
  | 'highlow'
  | 'roulette'
  | 'vault';

export type WeeklyEvent = {
  id: WeeklyEventId;
  name: string;
  shortDesc: string;
  description: string;
  /** チップ課金要素の説明 */
  gemFeatures: string;
};

export const WEEKLY_EVENTS: WeeklyEvent[] = [
  {
    id: 'sugoroku',
    name: '運命のすごろく',
    shortDesc: '正解でサイコロを獲得し、盤面を周回して報酬をゲット。出目操作でエターナル素材マスを狙おう。',
    description:
      '正解数に応じてサイコロを獲得し、盤面を周回して報酬を得ます。出目を操るアイテムで、確実にエターナル素材のマスに止まる戦略性がポイント。ログインボーナスや正解数でサイコロを付与。',
    gemFeatures: 'チップで黄金のサイコロ（出目指定）やダブルダイスを購入可能。',
  },
  {
    id: 'tower',
    name: '摩天楼のタワー',
    shortDesc: '三択のエレベーターで階層を登る。VIP・ギャンブラー・非常用ハッチから戦略的に選択。',
    description:
      '毎階でどのエレベーターに乗るか選択します。VIP専用機は確実に1階上昇、ギャンブラー・リフトは安い代わりに失敗で落下、非常用ハッチは最安だが失敗で階層XPリセット。高層ほどリフト成功率が低下。3時間ごとに変わる「塔の気候」でコストや成功率が変動。他プレイヤーが落下した階には遺失XP（ゴースト）が残り、拾うとボーナス。',
    gemFeatures: '黄金のオイル（リフト+20%）、衝撃吸収マット（落下1階軽減）、マスターキー（5階間VIP30%オフ）を時価で購入。',
  },
  {
    id: 'ichiban',
    name: '至高の1番くじ（ソーシャル）',
    shortDesc: '1箱100個のアイテムを全ユーザーで奪い合う。中身は完全可視化。',
    description:
      '1箱100個のアイテムを全ユーザーで奪い合います。箱の中身は完全可視化。残り枚数が少ない時のハイエナ争奪戦と、廃課金の箱買いを誘発。エターナル素材が1つ含まれた箱を即時補充。',
    gemFeatures: 'あと数枚で素材が出る瞬間にスタミナ回復とチップによる抽選券購入が爆発します。',
  },
  {
    id: 'bingo',
    name: '爆走ビンゴ',
    shortDesc: '正解数でランダムな数字を開け、ラインを揃えて報酬を得る。',
    description:
      '正解数でランダムな数字を開け、ラインを揃えて報酬を得ます。リーチがかかった時の狙い撃ちアイテムで一気に揃える快感がポイント。効率的に素材を回収する上級者向けの側面も。',
    gemFeatures: 'チップでマジックペン（好きな数字を開放）を購入可能。',
  },
  {
    id: 'treasure',
    name: '暗闇の財宝探索',
    shortDesc: 'グリッド状の暗いマップをタップして掘り進み、隠された素材を探す。',
    description:
      'グリッド状の暗いマップをタップして掘り進み、隠された素材を探します。正解で掘る権利を獲得。探索を効率化する便利アイテムでの時間短縮がポイント。',
    gemFeatures: 'チップで周囲9マスを照らす松明や、宝の位置をうっすら示すダウジングロッドを利用できます。',
  },
  {
    id: 'highlow',
    name: 'ハイアンドロー・ダブルアップ',
    shortDesc: '獲得したXPや素材を賭けて、次の数字が大きいか小さいかを当てる。連勝で倍増。',
    description:
      '獲得したXPや素材を賭けて、次の数字が今より大きいか小さいかを当てます。連勝で報酬が倍増する脳汁要素と、全没収の恐怖。10問正解ごとに挑戦権を獲得。',
    gemFeatures: '失敗して報酬を失うのを防ぐ保険証（セーフティガード）をチップで販売。リスクをコントロール。',
  },
  {
    id: 'roulette',
    name: 'ジャックポット・ルーレット',
    shortDesc: '正解数でスピン権を稼ぎ、巨大なルーレットで報酬を狙う。',
    description:
      '正解数でスピン権を稼ぎ、巨大なルーレットで報酬を狙います。ハズレ枠を消去して的中確率を上げる快感がポイント。',
    gemFeatures: 'チップでハズレ枠を破壊する黄金のハンマーや、当たり確率が2倍になるフィーバー権を提供。',
  },
  {
    id: 'vault',
    name: '黄金の金庫破り',
    shortDesc: 'ヒントを頼りに4桁の暗証番号を推測して金庫を開ける。',
    description:
      'ヒントを頼りに4桁の暗証番号を推測して金庫を開けます。正解で数字や位置のヒントを解禁。あと1桁で解けるという極限状態でのマスターキー需要がポイント。',
    gemFeatures: 'チップで購入できるマスターキーで1桁を確定解読し、最後の詰めをショートカット。',
  },
];

/** 1週間のミリ秒 */
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 第0週（運命のすごろく）の開始 = 今週の月曜 0:00 JST。2025年2月24日（月）0:00 JST = 2025-02-23 15:00 UTC。 */
const EPOCH_UTC_MS = new Date('2025-02-23T15:00:00.000Z').getTime();

/**
 * 現在の週インデックス（0〜）を取得。日本時間の月曜0時で週が切り替わる想定。
 */
export function getCurrentWeekIndex(): number {
  const now = Date.now();
  const elapsed = now - EPOCH_UTC_MS;
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / ONE_WEEK_MS);
}

/**
 * 今週のイベントを取得（8種類を順番にローテーション）
 */
export function getCurrentEvent(): WeeklyEvent {
  const index = getCurrentWeekIndex() % WEEKLY_EVENTS.length;
  return WEEKLY_EVENTS[index] ?? WEEKLY_EVENTS[0]!;
}

/**
 * 指定週のイベントを取得（0 = 第0週）
 */
export function getEventByWeekIndex(weekIndex: number): WeeklyEvent {
  const index = weekIndex % WEEKLY_EVENTS.length;
  return WEEKLY_EVENTS[index] ?? WEEKLY_EVENTS[0]!;
}

/**
 * 今週の開始・終了日時（JST）を返す
 */
export function getCurrentWeekRange(): { start: Date; end: Date } {
  const weekIndex = getCurrentWeekIndex();
  const start = new Date(EPOCH_UTC_MS + weekIndex * ONE_WEEK_MS);
  const end = new Date(start.getTime() + ONE_WEEK_MS - 1);
  return { start, end };
}
