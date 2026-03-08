/**
 * アプリ（Capacitor）でゲストログイン後にフルリロードすると WebView でセッションが読めない
 * ことがあるため、Preferences と localStorage の両方に一時保存してホームで復元する。
 */

const BRIDGE_KEY = 'supabase_session_bridge';

export type BridgeSession = { access_token: string; refresh_token: string };

/** アプリかどうか（ランタイム） */
function isApp(): boolean {
  if (typeof window === 'undefined') return false;
  const Cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Cap?.isNativePlatform?.() === true;
}

function writeToLocalStorage(session: BridgeSession): void {
  try {
    localStorage.setItem(BRIDGE_KEY, JSON.stringify(session));
  } catch {
    // 無視
  }
}

function readFromLocalStorage(): BridgeSession | null {
  try {
    const value = localStorage.getItem(BRIDGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as BridgeSession;
    return parsed?.access_token && parsed?.refresh_token ? parsed : null;
  } catch {
    return null;
  }
}

/** ゲストログイン成功後にセッションを保存。Preferences と localStorage の両方に書き、location.href で遷移すること */
export async function saveSessionForReload(session: BridgeSession): Promise<void> {
  if (!isApp()) return;
  writeToLocalStorage(session);
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: BRIDGE_KEY, value: JSON.stringify(session) });
  } catch {
    // 失敗しても localStorage に書いてある
  }
}

/** ホームでセッションを1回読み取り（Preferences → localStorage）。成功時は両方から削除 */
async function tryReadBridge(): Promise<BridgeSession | null> {
  try {
    if (isApp()) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: BRIDGE_KEY });
      if (value) {
        const parsed = JSON.parse(value) as BridgeSession;
        if (parsed?.access_token && parsed?.refresh_token) return parsed;
      }
    }
  } catch {
    // 無視
  }
  const fromStorage = readFromLocalStorage();
  if (fromStorage) return fromStorage;
  return null;
}

async function clearBridge(): Promise<void> {
  try {
    localStorage.removeItem(BRIDGE_KEY);
  } catch {
    // 無視
  }
  if (isApp()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: BRIDGE_KEY });
    } catch {
      // 無視
    }
  }
}

/** ホームマウント時に復元。実機で Preferences が遅れることがあるため 0 / 400 / 1000ms でリトライ */
export async function restoreSessionFromBridge(
  setSession: (session: BridgeSession) => Promise<void>
): Promise<boolean> {
  if (!isApp()) return false;
  for (const delayMs of [0, 400, 1000]) {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const parsed = await tryReadBridge();
    if (parsed) {
      await setSession(parsed);
      await clearBridge();
      return true;
    }
  }
  return false;
}
