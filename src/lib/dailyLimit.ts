const KEY = 'closer_last_play_date';
const KEY_COUNT = 'closer_play_count';
const KEY_FIRST_USE = 'closer_first_use_date';
const FREE_DAYS = 7;

export function getTodayKey(): string {
  return new Date().toDateString();
}

/** 初回利用日を取得（未設定なら今を記録して返す） */
function getFirstUseDate(): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const raw = localStorage.getItem(KEY_FIRST_USE);
    if (raw) return parseInt(raw, 10);
    const now = Date.now();
    localStorage.setItem(KEY_FIRST_USE, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

/** 最初の7日間の無料期間内か */
export function isWithinFirstFreeDays(): boolean {
  if (typeof window === 'undefined') return true;
  const first = getFirstUseDate();
  const now = Date.now();
  const daysSinceFirst = (now - first) / (1000 * 60 * 60 * 24);
  return daysSinceFirst < FREE_DAYS;
}

/** 今日のプレイ回数を取得（ローカルストレージ） */
export function getTodayPlayCount(): number {
  if (typeof window === 'undefined') return 0;
  const today = getTodayKey();
  try {
    const raw = localStorage.getItem(KEY_COUNT);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw);
    return date === today ? count : 0;
  } catch {
    return 0;
  }
}

/** 1回プレイしたことを記録 */
export function incrementTodayPlay(): void {
  if (typeof window === 'undefined') return;
  getFirstUseDate(); // 初回ならここで記録
  const today = getTodayKey();
  const count = getTodayPlayCount();
  localStorage.setItem(KEY_COUNT, JSON.stringify({ date: today, count: count + 1 }));
}

/** プレイ可能か（初回7日間は無制限、以降は1日1回無料） */
export function canPlayFreeToday(): boolean {
  if (isWithinFirstFreeDays()) return true;
  return getTodayPlayCount() < 1;
}
