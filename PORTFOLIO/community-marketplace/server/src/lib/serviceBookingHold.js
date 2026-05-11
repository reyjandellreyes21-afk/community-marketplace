/**
 * Service booking slot occupancy: which orders hold a calendar slot until finished or cancelled.
 */

const SLOT_BLOCKING_STATUSES = ["placed", "seller_accepted", "courier_assigned", "ready_for_pickup", "out_for_delivery"];

const REQUESTED_LINE = /^Requested:\s*(\d{4}-\d{2}-\d{2})\s+([01]\d|2[0-3]):[0-5]\d/im;

/** @param {string} comment */
export function parseRequestedSlotFromBuyerComment(comment) {
  const m = String(comment || "").match(REQUESTED_LINE);
  if (!m) return null;
  return { date: m[1], time: m[2] };
}

/** @param {{ service_booking_date?: unknown, service_booking_time?: unknown, buyer_comment?: unknown }} row */
export function effectiveServiceSlotFromOrderRow(row) {
  const rawD = row?.service_booking_date;
  const d = rawD != null ? String(rawD).trim().slice(0, 10) : "";
  const t = row?.service_booking_time != null ? String(row.service_booking_time).trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d) && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return { date: d, time: t };
  return parseRequestedSlotFromBuyerComment(String(row?.buyer_comment ?? ""));
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {{ listingId: string, dateIso: string, timeHm: string, excludeOrderId?: string | null }} args
 * @returns {Promise<{ taken: boolean, conflictingOrderId?: string }>}
 */
export async function findConflictingServiceBooking(admin, { listingId, dateIso, timeHm, excludeOrderId = null }) {
  const lid = String(listingId || "").trim();
  const d = String(dateIso || "").trim();
  const t = String(timeHm || "").trim();
  if (!lid || !d || !t) return { taken: false };

  const trySelect = async (withSlotCols) => {
    const base = admin.from("orders").select(withSlotCols).eq("listing_id", lid).in("status", SLOT_BLOCKING_STATUSES);
    const { data, error } = await base;
    return { data, error };
  };

  let rows = null;
  let err = null;
  ({ data: rows, error: err } = await trySelect("id, status, buyer_comment, service_booking_date, service_booking_time"));
  if (err && /service_booking_date|service_booking_time|schema cache|Could not find/i.test(String(err.message || ""))) {
    ({ data: rows, error: err } = await trySelect("id, status, buyer_comment"));
  }
  if (err) throw err;

  for (const r of rows || []) {
    const slot = effectiveServiceSlotFromOrderRow(r);
    if (!slot || slot.date !== d || slot.time !== t) continue;
    const rid = String(r?.id || "").trim();
    if (excludeOrderId && rid === String(excludeOrderId).trim()) continue;
    return { taken: true, conflictingOrderId: rid };
  }
  return { taken: false };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} listingId
 * @returns {Promise<{ date: string, time: string }[]>}
 */
export async function listHeldServiceSlotsForListing(admin, listingId) {
  const lid = String(listingId || "").trim();
  if (!lid) return [];

  const trySelect = async (withSlotCols) => {
    const { data, error } = await admin
      .from("orders")
      .select(withSlotCols)
      .eq("listing_id", lid)
      .in("status", SLOT_BLOCKING_STATUSES);
    return { data, error };
  };

  let rows = null;
  let err = null;
  ({ data: rows, error: err } = await trySelect("id, buyer_comment, service_booking_date, service_booking_time"));
  if (err && /service_booking_date|service_booking_time|schema cache|Could not find/i.test(String(err.message || ""))) {
    ({ data: rows, error: err } = await trySelect("id, buyer_comment"));
  }
  if (err) throw err;

  /** @type {{ date: string, time: string }[]} */
  const out = [];
  const seen = new Set();
  for (const r of rows || []) {
    const slot = effectiveServiceSlotFromOrderRow(r);
    if (!slot) continue;
    const k = `${slot.date}\t${slot.time}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(slot);
  }
  return out;
}
