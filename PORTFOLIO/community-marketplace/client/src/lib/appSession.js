export const AUTH_TOKEN_STORAGE_KEY = "linkmart_session_v1";
export const LEGACY_AUTH_TOKEN_KEY = "quiz_token";
export const THEME_STORAGE_KEY = "linkmart_theme_v1";
export const LEGACY_THEME_KEY_V2 = "quiz_theme_v2";
export const LEGACY_THEME_KEY_V1 = "quiz_theme";
export const ACTIVE_VIEW_STORAGE_KEY = "linkmart_active_view_v1";
export const ACTIVITY_TAB_STORAGE_KEY = "linkmart_activity_tab_v1";
export const COURIER_HUB_TAB_STORAGE_KEY = "linkmart_courier_hub_tab_v1";
/** Persist product vs service listing composer while `MY_LISTINGS` is active (survives refresh). */
export const LISTING_UPLOAD_KIND_STORAGE_KEY = "linkmart_listing_upload_kind_v1";

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

export function readActiveView() {
  if (typeof window === "undefined") return "";
  return String(localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY) || "").trim();
}

export function writeActiveView(view) {
  if (typeof window === "undefined") return;
  const next = String(view || "").trim();
  if (!next) {
    localStorage.removeItem(ACTIVE_VIEW_STORAGE_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, next);
}

export function clearActiveView() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_VIEW_STORAGE_KEY);
}

export function readActivityTab() {
  if (typeof window === "undefined") return "";
  return String(localStorage.getItem(ACTIVITY_TAB_STORAGE_KEY) || "").trim();
}

export function writeActivityTab(tab) {
  if (typeof window === "undefined") return;
  const next = String(tab || "").trim();
  if (!next) {
    localStorage.removeItem(ACTIVITY_TAB_STORAGE_KEY);
    return;
  }
  localStorage.setItem(ACTIVITY_TAB_STORAGE_KEY, next);
}

export function readCourierHubTab() {
  if (typeof window === "undefined") return "";
  return String(localStorage.getItem(COURIER_HUB_TAB_STORAGE_KEY) || "").trim();
}

export function writeCourierHubTab(tab) {
  if (typeof window === "undefined") return;
  const next = String(tab || "").trim();
  if (!next) {
    localStorage.removeItem(COURIER_HUB_TAB_STORAGE_KEY);
    return;
  }
  localStorage.setItem(COURIER_HUB_TAB_STORAGE_KEY, next);
}

/** @returns {"product" | "service"} */
export function readListingUploadKind() {
  if (typeof window === "undefined") return "product";
  const raw = String(localStorage.getItem(LISTING_UPLOAD_KIND_STORAGE_KEY) || "").trim().toLowerCase();
  return raw === "service" ? "service" : "product";
}

/** @param {"product" | "service"} kind */
export function writeListingUploadKind(kind) {
  if (typeof window === "undefined") return;
  const next = String(kind || "").trim().toLowerCase();
  if (next === "service") {
    localStorage.setItem(LISTING_UPLOAD_KIND_STORAGE_KEY, "service");
  } else {
    localStorage.removeItem(LISTING_UPLOAD_KIND_STORAGE_KEY);
  }
}

export function clearListingUploadKind() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LISTING_UPLOAD_KIND_STORAGE_KEY);
}
