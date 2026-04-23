export const CPR_MARKETPLACE_STORAGE_KEY = "cpr-marketplace-state-v1";
export const CPR_MARKETPLACE_SESSION_KEY = "cpr-marketplace-session-v1";

export function loadPersistedState() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CPR_MARKETPLACE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persists marketplace state. Use `{ silent: true }` when the writer is the home page
 * React tree (avoids redundant sync events on every state tick).
 */
export function persistMarketplaceState(updates, options = {}) {
  const { silent = false } = options;
  const prev = loadPersistedState() ?? {};
  const merged = {
    users: updates.users ?? prev.users ?? [],
    products: updates.products ?? prev.products ?? [],
    orders: updates.orders ?? prev.orders ?? [],
    cart: updates.cart ?? prev.cart ?? [],
    currentUserId:
      updates.currentUserId !== undefined ? updates.currentUserId : prev.currentUserId ?? null,
    activeMode: updates.activeMode ?? prev.activeMode ?? "buyer",
  };
  if (typeof window === "undefined") return;
  localStorage.setItem(CPR_MARKETPLACE_STORAGE_KEY, JSON.stringify(merged));
  if (!silent) {
    window.dispatchEvent(new Event("cpr-marketplace-state-changed"));
  }
}

export function loadSession() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CPR_MARKETPLACE_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function persistSession(session) {
  if (typeof window === "undefined") return;
  if (!session) {
    localStorage.removeItem(CPR_MARKETPLACE_SESSION_KEY);
    return;
  }
  localStorage.setItem(CPR_MARKETPLACE_SESSION_KEY, JSON.stringify(session));
}
