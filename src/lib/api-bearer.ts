const API_BEARER_TOKEN_KEY = 'app_api_bearer_token';

export function setApiBearerToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.setItem(API_BEARER_TOKEN_KEY, token);
    else localStorage.removeItem(API_BEARER_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function getApiBearerToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const direct = localStorage.getItem(API_BEARER_TOKEN_KEY);
    if (direct) return direct;
  } catch {
    // ignore
  }
  return null;
}

export function getApiBearerTokenKey(): string {
  return API_BEARER_TOKEN_KEY;
}

