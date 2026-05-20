/**
 * Persists user-visible notifications for order lifecycle + reviews (service role; failures are non-fatal).
 */

import { supabaseAdmin } from "./supabase.js";

const isSchemaMissingError = (error) =>
  Boolean(error) &&
  (error.code === "PGRST205" || /schema cache/i.test(String(error.message || "")));

/** Matches client `orderStatusToTabId` / Activity order subtabs. */
export function ordersTabForStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "placed" || s === "pending") return "pending";
  if (s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  return "processing";
}

/**
 * @param {{
 *   recipientUserId: string,
 *   actorUserId?: string | null,
 *   orderId: string,
 *   recipientRole: "buyer" | "seller",
 *   title: string,
 *   body: string,
 *   orderStatusForTab: string,
 * }} p
 */
export async function notifyUserOrderEvent(p) {
  const recipientUserId = String(p.recipientUserId || "").trim();
  const orderId = String(p.orderId || "").trim();
  if (!recipientUserId || !orderId) return;

  const title = String(p.title || "").trim().slice(0, 200);
  const body = String(p.body || "").trim().slice(0, 2000);
  if (!title || !body) return;

  const meta = {
    ordersRole: p.recipientRole,
    ordersTab: ordersTabForStatus(p.orderStatusForTab),
  };

  try {
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: recipientUserId,
      actor_id: p.actorUserId ? String(p.actorUserId).trim() || null : null,
      type: "order_update",
      entity_type: "order",
      entity_id: orderId,
      title,
      body,
      metadata: meta,
    });
    if (error && isSchemaMissingError(error)) return;
    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[notifyUserOrderEvent]", error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[notifyUserOrderEvent]", e?.message || e);
  }
}

/**
 * Courier invited to a delivery (opens Activity → Courier → Tasks).
 */
export async function notifyCourierInvitation({
  courierUserId,
  actorUserId,
  orderId,
  title,
  body,
}) {
  const uid = String(courierUserId || "").trim();
  const oid = String(orderId || "").trim();
  if (!uid || !oid) return;

  try {
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: uid,
      actor_id: actorUserId ? String(actorUserId).trim() || null : null,
      type: "courier_invite",
      entity_type: "order",
      entity_id: oid,
      title: String(title || "Delivery invitation").trim().slice(0, 200),
      body: String(body || "").trim().slice(0, 2000),
      metadata: {
        targetView: "activity",
        activityTab: "courier",
        courierHubTab: "tasks",
      },
    });
    if (error && isSchemaMissingError(error)) return;
    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[notifyCourierInvitation]", error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[notifyCourierInvitation]", e?.message || e);
  }
}

/**
 * Buyer rated courier — notify courier (opens Activity → Courier → Stats).
 */
export async function notifyCourierDeliveryFeedback({
  courierUserId,
  actorUserId,
  orderId,
  title,
  body,
}) {
  const uid = String(courierUserId || "").trim();
  const oid = String(orderId || "").trim();
  if (!uid || !oid) return;

  try {
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: uid,
      actor_id: actorUserId ? String(actorUserId).trim() || null : null,
      type: "courier_feedback",
      entity_type: "order",
      entity_id: oid,
      title: String(title || "New delivery feedback").trim().slice(0, 200),
      body: String(body || "").trim().slice(0, 2000),
      metadata: {
        targetView: "activity",
        activityTab: "courier",
        courierHubTab: "stats",
      },
    });
    if (error && isSchemaMissingError(error)) return;
    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[notifyCourierDeliveryFeedback]", error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[notifyCourierDeliveryFeedback]", e?.message || e);
  }
}
