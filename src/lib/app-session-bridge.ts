/**
 * アプリ（Capacitor）でゲストログイン後にフルリロードすると WebView の localStorage で
 * セッションが読めないことがあるため、Preferences に一時保存してホームで復元する。
 */

const BRIDGE_KEY = 'supabase_session_bridge';

export type BridgeSession = { access_token: string; refresh_token: string };

/** アプリかどうか（ランタイム） */
function isApp(): boolean {
  if (typeof window === 'undefined') return false;
  const Cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Cap?.isNativePlatform?.() === true;
}

/** ゲストログイン成功後にセッションを Preferences に保存。保存後に location.href で遷移すること */
export async function saveSessionForReload(session: BridgeSession): Promise<void> {
  if (!isApp()) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: BRIDGE_KEY, value: JSON.stringify(session) });
  } catch {
    // 失敗しても続行（従来の getSession に任せる）
  }
}

/** ホームマウント時に Preferences からセッションを復元。あれば setSession してキーを削除 */
export async function restoreSessionFromBridge(
  setSession: (session: BridgeSession) => Promise<void>
): Promise<boolean> {
  if (!isApp()) return false;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: BRIDGE_KEY });
    if (!value) return false;
    const parsed = JSON.parse(value) as BridgeSession;
    if (parsed?.access_token && parsed?.refresh_token) {
      await setSession(parsed);
      await Preferences.remove({ key: BRIDGE_KEY });
      return true;
    }
  } catch {
    // 無視
  }
  return false;
}
