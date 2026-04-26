export const AUTH_TOKEN_STORAGE_KEY = "linkmart_session_v1";
export const LEGACY_AUTH_TOKEN_KEY = "quiz_token";
export const THEME_STORAGE_KEY = "linkmart_theme_v1";
export const LEGACY_THEME_KEY_V2 = "quiz_theme_v2";
export const LEGACY_THEME_KEY_V1 = "quiz_theme";

export function readAuthToken() {
  if (typeof window === "undefined") return "";
  const next = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (next) return next;
  const legacy = localStorage.getItem(LEGACY_AUTH_TOKEN_KEY) || "";
  if (legacy) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  }
  return legacy;
}

export function writeAuthToken(token) {
  if (typeof window === "undefined") return;
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

export function readThemeMode() {
  if (typeof window === "undefined") return "light";
  if (localStorage.getItem(THEME_STORAGE_KEY) === "dark") return "dark";
  if (localStorage.getItem(LEGACY_THEME_KEY_V2) === "dark") return "dark";
  return "light";
}

export function writeThemeMode(theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  localStorage.removeItem(LEGACY_THEME_KEY_V2);
  localStorage.removeItem(LEGACY_THEME_KEY_V1);
}
