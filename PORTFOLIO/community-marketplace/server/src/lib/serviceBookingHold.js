/**
 * Service booking slot occupancy: which orders hold a calendar slot until finished or cancelled.
 */

/** Must match partial unique index `orders_listing_service_slot_active_uidx` (all non-terminal pipeline statuses). */
const SLOT_BLOCKING_STATUSES = [
  "placed",
  "seller_accepted",
  "courier_assigned",
  "provider_on_the_way",
  "ready_for_pickup",
  "out_for_delivery",
];

/** Any line: `Requested:` + date + time (allows unpadded date, 1–2 digit hour, optional :ss). */
const REQUESTED_LINE_FLEX = /Requested:\s*(\d{4}-\d{1,2}-\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?/i;
const HM_VALID = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_STRICT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** DATE columns / ISO timestamps must become strict `YYYY-MM-DD` for slot keys. */
export function normalizeSlotDateIso(raw) {
  const head = String(raw ?? "").trim().slice(0, 10);
  const m = head.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";
  const out = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return ISO_DATE_STRICT.test(out) ? out : "";
}

/** Postgres TIME / strings may be `11:30:00`, `9:00`; avoid treating `2026-…` as a time. */
export function normalizeSlotTimeHm(raw) {
  const s = String(raw ?? "").trim();
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/);
  if (!m) m = s.match(/T(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return "";
  const out = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return HM_VALID.test(out) ? out : "";
}

/** @param {string} comment */
export function parseRequestedSlotFromBuyerComment(comment) {
  const m = String(comment || "").match(REQUESTED_LINE_FLEX);
  if (!m) return null;
  const d = normalizeSlotDateIso(m[1]);
  const t = normalizeSlotTimeHm(`${m[2]}:${m[3]}`);
  if (d && t) return { date: d, time: t };
  return null;
}

/** @param {{ service_booking_date?: unknown, serviceBookingDate?: unknown, service_booking_time?: unknown, serviceBookingTime?: unknown, buyer_comment?: unknown, buyerComment?: unknown } | null | undefined} row */
export function effectiveServiceSlotFromOrderRow(row) {
  if (!row || typeof row !== "object") return null;
  const comment = String(row?.buyer_comment ?? row?.buyerComment ?? "");
  const rawDate = row?.service_booking_date ?? row?.serviceBookingDate;
  const rawTime = row?.service_booking_time ?? row?.serviceBookingTime;
  const dCol = normalizeSlotDateIso(rawDate != null ? String(rawDate) : "");
  const tCol = normalizeSlotTimeHm(rawTime);
  if (dCol && tCol) return { date: dCol, time: tCol };

  const fromComment = parseRequestedSlotFromBuyerComment(comment);
  if (dCol && !tCol && fromComment && fromComment.date === dCol && fromComment.time) {
    return { date: dCol, time: fromComment.time };
  }
  if (!dCol && tCol && fromComment && fromComment.time === tCol && fromComment.date) {
    return { date: fromComment.date, time: tCol };
  }
  if (fromComment) return fromComment;
  return null;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {{ listingId: string, dateIso: string, timeHm: string, excludeOrderId?: string | null, excludeOrderIds?: (string|null|undefined)[] | null }} args
 * @returns {Promise<{ taken: boolean, conflictingOrderId?: string }>}
 */
export async function findConflictingServiceBooking(admin, { listingId, dateIso, timeHm, excludeOrderId = null, excludeOrderIds = null }) {
  const lid = String(listingId || "").trim();
  const dNorm = normalizeSlotDateIso(String(dateIso || "").trim());
  const tNorm = normalizeSlotTimeHm(timeHm);
  if (!lid || !dNorm || !tNorm) return { taken: false };

  const exclude = new Set(
    [excludeOrderId, ...(Array.isArray(excludeOrderIds) ? excludeOrderIds : [])]
      .filter(Boolean)
      .map((x) => String(x).trim()),
  );

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
    if (!slot || slot.date !== dNorm || slot.time !== tNorm) continue;
    const rid = String(r?.id || "").trim();
    if (exclude.has(rid)) continue;
    return { taken: true, conflictingOrderId: rid };
  }
  return { taken: false };
}

/** Stronger status wins when two orders map to the same slot key (index in pipeline). */
function slotBlockingStatusStrength(status) {
  const s = String(status || "").trim();
  const i = SLOT_BLOCKING_STATUSES.indexOf(s);
  return i === -1 ? -1 : i;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} listingId
 * @returns {Promise<{ date: string, time: string, status: string }[]>}
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
  ({ data: rows, error: err } = await trySelect("id, status, buyer_comment, service_booking_date, service_booking_time"));
  if (err && /service_booking_date|service_booking_time|schema cache|Could not find/i.test(String(err.message || ""))) {
    ({ data: rows, error: err } = await trySelect("id, status, buyer_comment"));
  }
  if (err) throw err;

  /** @type {Map<string, { date: string, time: string, status: string }>} */
  const byKey = new Map();
  for (const r of rows || []) {
    const slot = effectiveServiceSlotFromOrderRow(r);
    if (!slot) continue;
    const k = `${slot.date}\t${slot.time}`;
    const st = String(r?.status || "").trim();
    if (!st) continue;
    const prev = byKey.get(k);
    if (!prev || slotBlockingStatusStrength(st) > slotBlockingStatusStrength(prev.status)) {
      byKey.set(k, { date: slot.date, time: slot.time, status: st });
    }
  }
  return [...byKey.values()];
}
