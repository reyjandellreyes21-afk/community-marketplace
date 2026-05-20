/**
 * Marketplace notification inbox: API mapping, local session items, realtime helpers.
 */

import { apiRequest } from "./appApi.js";

export const NOTIFICATION_LOCAL_SESSION_STORAGE_KEY = "linkmart_notification_local_session_v1";
/** @deprecated One-time migration source */
const LEGACY_NOTIFICATION_INBOX_STORAGE_KEY = "linkmart_notification_inbox_v1";

/** Migrate old monolithic inbox key into local-session-only storage once. */
export function migrateLegacyNotificationInboxStorage() {
  try {
    if (typeof window === "undefined") return;
    const legacyRaw = window.localStorage.getItem(LEGACY_NOTIFICATION_INBOX_STORAGE_KEY);
    if (!legacyRaw) return;
    const nextRaw = window.localStorage.getItem(NOTIFICATION_LOCAL_SESSION_STORAGE_KEY);
    if (nextRaw) {
      window.localStorage.removeItem(LEGACY_NOTIFICATION_INBOX_STORAGE_KEY);
      return;
    }
    const parsed = JSON.parse(legacyRaw);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(LEGACY_NOTIFICATION_INBOX_STORAGE_KEY);
      return;
    }
    const locals = parsed
      .map((item) => ({
        id: (() => {
          const raw = String(item?.id || "").trim();
          if (raw.startsWith("lm-local-")) return raw;
          return raw ? `lm-local-${raw}` : `lm-local-${Date.now()}`;
        })(),
        source: /** @type {const} */ ("local"),
        text: String(item?.text || "").trim(),
        title: null,
        createdAt: Number(item?.createdAt || 0),
        read: !!item?.read,
        type: String(item?.type || "").trim() || "marketplace",
      }))
      .filter((item) => item.id && item.text && Number.isFinite(item.createdAt));
    window.localStorage.setItem(NOTIFICATION_LOCAL_SESSION_STORAGE_KEY, JSON.stringify(locals));
    window.localStorage.removeItem(LEGACY_NOTIFICATION_INBOX_STORAGE_KEY);
  } catch {
    try {
      window.localStorage.removeItem(LEGACY_NOTIFICATION_INBOX_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
export const NOTIFICATION_INBOX_MAX_ITEMS = 80;
export const NOTIFICATION_REALTIME_DEBOUNCE_MS = 350;
export const NOTIFICATION_POLL_FALLBACK_MS = 12000;

/**
 * When true, the inbox UI and unread badge only include notifications that can deep-link
 * (entity id + known entity type, or explicit metadata.targetView).
 */
export const NOTIFICATION_INBOX_NAVIGABLE_ONLY = true;

/** @typedef {{ id: string, source: "server" | "local", text: string, title?: string | null, createdAt: number, read: boolean, type: string, entityType?: string | null, entityId?: string | null, metadata?: Record<string, unknown> }} NotificationInboxItem */

const KNOWN_ENTITY_TYPES = new Set([
  "order",
  "purchase",
  "sale",
  "listing",
  "product",
  "marketplace_listing",
  "community",
  "community_shop",
  "conversation",
  "messages",
  "message",
]);

/** Whether this row should appear in the navigable-only inbox and support tap-to-go. */
export function isNotificationNavigable(item) {
  if (!item || typeof item !== "object") return false;
  const meta = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  if (meta.navigate === false) return false;
  if (String(meta.targetView || "").trim()) return true;

  const eid = String(item.entityId || meta.entityId || "").trim();
  if (!eid) return false;

  const etRaw = String(item.entityType || meta.entityType || "").trim().toLowerCase();
  if (etRaw && KNOWN_ENTITY_TYPES.has(etRaw)) return true;

  const t = String(item.type || "").toLowerCase();
  if (t.includes("order") || t.includes("delivery") || t.includes("purchase") || t.includes("courier")) return true;
  if (t.includes("listing") || t.includes("product")) return true;
  if (t.includes("community")) return true;
  if (t.includes("message") || t.includes("chat")) return true;

  return false;
}

export function createLocalNotificationId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `lm-local-${crypto.randomUUID()}`
    : `lm-local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function classifyNotificationType(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("delivery")) return "delivery";
  if (lower.includes("order")) return "orders";
  if (lower.includes("joined") || lower.includes("left") || lower.includes("community")) return "community";
  if (lower.includes("error") || lower.includes("could not") || lower.includes("unavailable")) return "system";
  return "marketplace";
}

/** Map GET /notifications row to inbox item. */
export function notificationApiToInboxItem(row) {
  const title = String(row?.title || "").trim();
  const body = String(row?.body || "").trim();
  const text =
    title && body ? `${title}: ${body}` : body || title || String(row?.body || row?.title || "Notification").trim() || "Notification";
  const createdRaw = row?.createdAt ?? row?.created_at;
  const createdMs = createdRaw ? new Date(createdRaw).getTime() : Date.now();
  const metaRaw = row?.metadata;
  const metadata = metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw) ? { ...metaRaw } : {};
  const entityTypeRaw = row?.entityType ?? row?.entity_type;
  const entityIdRaw = row?.entityId ?? row?.entity_id;
  return {
    id: String(row?.id || "").trim(),
    source: /** @type {const} */ ("server"),
    text,
    title: title || null,
    createdAt: Number.isFinite(createdMs) ? createdMs : Date.now(),
    read: Boolean(row?.isRead ?? row?.is_read),
    type: String(row?.type || "marketplace").trim() || "marketplace",
    entityType: entityTypeRaw != null && String(entityTypeRaw).trim() ? String(entityTypeRaw).trim() : null,
    entityId: entityIdRaw != null && String(entityIdRaw).trim() ? String(entityIdRaw).trim() : null,
    metadata,
  };
}

/** Map Supabase realtime `payload.new` (snake_case) to inbox item. */
export function postgresNotificationNewToInboxItem(row) {
  if (!row || typeof row !== "object") return null;
  const apiShape = {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    created_at: row.created_at,
    is_read: row.is_read,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: row.metadata,
  };
  const item = notificationApiToInboxItem(apiShape);
  return item.id ? item : null;
}

export function readLocalSessionNotificationsFromStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_LOCAL_SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: String(item?.id || "").trim(),
        source: /** @type {const} */ ("local"),
        text: String(item?.text || "").trim(),
        title: item?.title != null ? String(item.title) : null,
        createdAt: Number(item?.createdAt || 0),
        read: !!item?.read,
        type: String(item?.type || "").trim() || "marketplace",
        entityType: item?.entityType != null && String(item.entityType).trim() ? String(item.entityType).trim() : null,
        entityId: item?.entityId != null && String(item.entityId).trim() ? String(item.entityId).trim() : null,
        metadata:
          item?.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? { ...item.metadata } : {},
      }))
      .filter((item) => item.id && item.text && Number.isFinite(item.createdAt));
  } catch {
    return [];
  }
}

export function writeLocalSessionNotificationsToStorage(items) {
  try {
    if (typeof window === "undefined") return;
    const locals = items.filter((i) => i.source === "local").slice(0, NOTIFICATION_INBOX_MAX_ITEMS);
    window.localStorage.setItem(NOTIFICATION_LOCAL_SESSION_STORAGE_KEY, JSON.stringify(locals));
  } catch {
    /* ignore */
  }
}

/** Merge server + local-only rows, newest first, cap length. */
export function mergeNotificationInboxLists(serverItems, localItems) {
  const byId = new Map();
  for (const it of serverItems) {
    if (it?.id) byId.set(String(it.id), it);
  }
  for (const it of localItems) {
    if (it?.id && it.source === "local" && !byId.has(String(it.id))) byId.set(String(it.id), it);
  }
  const merged = Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return merged.slice(0, NOTIFICATION_INBOX_MAX_ITEMS);
}

export async function fetchNotificationsFromApi(token, { limit = NOTIFICATION_INBOX_MAX_ITEMS } = {}) {
  const q = new URLSearchParams({ limit: String(limit), offset: "0" });
  const payload = await apiRequest(`/notifications?${q.toString()}`, { token });
  if (!payload || typeof payload !== "object") {
    return { ok: false, notifications: [], unreadCount: 0, schemaMissing: false };
  }
  if (payload.schemaMissing) {
    return { ok: true, notifications: [], unreadCount: 0, schemaMissing: true };
  }
  const rows = Array.isArray(payload.notifications) ? payload.notifications : [];
  const inbox = rows.map(notificationApiToInboxItem).filter((n) => n.id);
  const unreadCount =
    typeof payload.unreadCount === "number"
      ? payload.unreadCount
      : inbox.reduce((s, n) => s + (n.read ? 0 : 1), 0);
  return { ok: true, notifications: inbox, unreadCount, schemaMissing: false };
}

export async function markNotificationReadApi(token, id) {
  const sid = String(id || "").trim();
  if (!sid || sid.startsWith("lm-local-")) return { ok: true };
  await apiRequest(`/notifications/${encodeURIComponent(sid)}/read`, { method: "PATCH", token });
  return { ok: true };
}

export async function markAllNotificationsReadApi(token, ids = null) {
  const body = ids && ids.length ? { ids } : {};
  await apiRequest("/notifications/read", { method: "PATCH", token, body });
  return { ok: true };
}

export async function deleteNotificationApi(token, id) {
  const sid = String(id || "").trim();
  if (!sid || sid.startsWith("lm-local-")) return { ok: true };
  await apiRequest(`/notifications/${encodeURIComponent(sid)}`, { method: "DELETE", token });
  return { ok: true };
}

export async function deleteAllNotificationsApi(token) {
  await apiRequest("/notifications", { method: "DELETE", token });
  return { ok: true };
}

/** Hard-delete all server notifications for current user (RLS). */
export async function deleteAllNotificationsRemote(supabase, userId) {
  if (!supabase || !userId) return { ok: false };
  const { error } = await supabase.from("notifications").delete().eq("user_id", String(userId));
  return { ok: !error, error };
}

export async function deleteNotificationRemote(supabase, id) {
  const sid = String(id || "").trim();
  if (!sid || sid.startsWith("lm-local-")) return { ok: true };
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("notifications").delete().eq("id", sid);
  return { ok: !error, error };
}
