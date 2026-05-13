import {
  formatAvailabilityScheduleHuman,
  isWeeklyAvailabilityComplete,
  parseAvailabilitySchedule,
} from "./serviceAvailabilitySchedule.js";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * True if `timeHm` falls in `[windowStart, windowEnd)` (same convention as generated half-hour slots).
 * @param {unknown} timeHm
 * @param {unknown} windowStart `HH:mm`
 * @param {unknown} windowEnd `HH:mm`
 */
export function bookingTimeHmWithinWindow(timeHm, windowStart, windowEnd) {
  const t = normalizeBookingTimeHm(timeHm);
  const a = normalizeBookingTimeHm(windowStart);
  const b = normalizeBookingTimeHm(windowEnd);
  if (!t || !a || !b || !TIME_RE.test(t) || !TIME_RE.test(a) || !TIME_RE.test(b)) return false;
  if (a >= b) return false;
  return t >= a && t < b;
}
const REQUESTED_LINE_FLEX = /Requested:\s*(\d{4}-\d{1,2}-\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?/i;

/** DB/API may return `11:30:00` or `9:00` — normalize to HH:mm so slot keys match the picker. */
export function normalizeBookingTimeHm(raw) {
  const s = String(raw ?? "").trim();
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/);
  if (!m) m = s.match(/T(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return "";
  const out = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return TIME_RE.test(out) ? out : "";
}

/**
 * Parses typed times into `HH:mm` for slot matching (24h and 12h).
 * @param {unknown} raw
 * @returns {string} normalized `HH:mm` or ""
 */
export function parseUserTimeInputToHm(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const direct = normalizeBookingTimeHm(s);
  if (direct) return direct;
  const compact = s.replace(/\s+/g, " ").trim();
  const m12 = compact.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m12) return "";
  let h = Number(m12[1]);
  const min = Number(m12[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min < 0 || min > 59 || h < 1 || h > 12) return "";
  const pm = m12[3].toLowerCase() === "pm";
  if (pm) {
    if (h !== 12) h += 12;
  } else if (h === 12) {
    h = 0;
  }
  return normalizeBookingTimeHm(`${h}:${min}`);
}

/** @param {unknown} hm `HH:mm` */
export function timeHmTo12Parts(hm) {
  const t = normalizeBookingTimeHm(hm);
  if (!t || !TIME_RE.test(t)) return null;
  const [H, mmRaw] = t.split(":").map(Number);
  const mer = H >= 12 ? "PM" : "AM";
  let h12 = H % 12;
  if (h12 === 0) h12 = 12;
  return { h12: String(h12), mm: String(mmRaw).padStart(2, "0"), mer };
}

/**
 * @param {unknown} h12Str clock 1–12
 * @param {unknown} mmStr minutes `00`–`59`
 * @param {"AM"|"PM"} mer
 * @returns {string} normalized `HH:mm` or ""
 */
export function hmFrom12Parts(h12Str, mmStr, mer) {
  if (mer !== "AM" && mer !== "PM") return "";
  const h12 = Number(h12Str);
  const mm = Number(String(mmStr ?? "").replace(/\D/g, "") || 0);
  if (!Number.isFinite(h12) || h12 < 1 || h12 > 12 || !Number.isFinite(mm) || mm < 0 || mm > 59) return "";
  let H;
  if (mer === "AM") {
    H = h12 === 12 ? 0 : h12;
  } else {
    H = h12 === 12 ? 12 : h12 + 12;
  }
  return normalizeBookingTimeHm(`${H}:${mm}`);
}

/** Calendar + API must share one key shape: `YYYY-MM-DD` with zero-padded month/day. */
export function normalizeBookingDateIso(raw) {
  const head = String(raw ?? "").trim().slice(0, 10);
  const m = head.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";
  const y = m[1];
  const mo = m[2].padStart(2, "0");
  const d = m[3].padStart(2, "0");
  const out = `${y}-${mo}-${d}`;
  return ISO_DATE.test(out) ? out : "";
}

/** @param {string} comment */
export function parseRequestedSlotFromBuyerComment(comment) {
  const m = String(comment || "").match(REQUESTED_LINE_FLEX);
  if (!m) return null;
  const d = normalizeBookingDateIso(m[1]);
  const t = normalizeBookingTimeHm(`${m[2]}:${m[3]}`);
  if (d && t) return { date: d, time: t };
  return null;
}

/**
 * Resolves a held slot from API-shaped order rows (mirrors server `effectiveServiceSlotFromOrderRow`).
 * @param {{ serviceBookingDate?: unknown, service_booking_date?: unknown, serviceBookingTime?: unknown, service_booking_time?: unknown, buyerComment?: unknown, buyer_comment?: unknown } | null | undefined} orderLike
 * @returns {{ date: string, time: string } | null}
 */
export function effectiveServiceSlotFromOrderLike(orderLike) {
  if (!orderLike || typeof orderLike !== "object") return null;
  const comment = String(orderLike?.buyerComment ?? orderLike?.buyer_comment ?? "");
  const rawD = orderLike?.serviceBookingDate ?? orderLike?.service_booking_date;
  const d = normalizeBookingDateIso(rawD != null ? String(rawD) : "");
  const rawT = orderLike?.serviceBookingTime ?? orderLike?.service_booking_time;
  const t = normalizeBookingTimeHm(rawT);
  if (d && t && TIME_RE.test(t)) return { date: d, time: t };

  const fromComment = parseRequestedSlotFromBuyerComment(comment);
  if (d && !t && fromComment && fromComment.date === d && fromComment.time && TIME_RE.test(fromComment.time)) {
    return { date: d, time: fromComment.time };
  }
  if (!d && t && fromComment && fromComment.time === t && fromComment.date && TIME_RE.test(t)) {
    return { date: fromComment.date, time: t };
  }
  if (fromComment && fromComment.date && fromComment.time && TIME_RE.test(fromComment.time)) return fromComment;
  return null;
}

function toIsoDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * ISO date strings (local calendar) for upcoming days that match weekly `days` (0=Sun … 6=Sat).
 * @param {{ days: number[], start: string, end: string }} parsedWeekly
 * @param {number} [maxDays] scan at most this many calendar days forward
 */
export function getBookableIsoDatesForWeekly(parsedWeekly, maxDays = 120) {
  const allowed = new Set(parsedWeekly.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  if (!allowed.size) return [];
  const out = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  for (let i = 0; i < maxDays; i += 1) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + i);
    if (allowed.has(d.getDay())) out.push(toIsoDateLocal(d));
  }
  return out;
}

/** Half-hour steps from `start` up to but excluding `end` (same HH:mm rules as upload). */
export function halfHourTimesBetween(start, end) {
  if (!TIME_RE.test(String(start || "")) || !TIME_RE.test(String(end || ""))) return [];
  if (String(start) >= String(end)) return [];
  const out = [];
  const [sh, sm] = String(start)
    .split(":")
    .map((x) => Number(x));
  const [eh, em] = String(end)
    .split(":")
    .map((x) => Number(x));
  let t = sh * 60 + sm;
  const endM = eh * 60 + em;
  while (t < endM) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    t += 30;
  }
  return out;
}

/**
 * @param {{ serviceMeta?: object, verticalId?: string, categories?: string } | null | undefined} listingLike
 * @returns {{ required: boolean, dates: string[], times: string[], scheduleHuman: string, windowStart: string, windowEnd: string }}
 */
export function slotOptionsForServiceListing(listingLike) {
  const meta =
    listingLike?.serviceMeta && typeof listingLike.serviceMeta === "object" && !Array.isArray(listingLike.serviceMeta)
      ? listingLike.serviceMeta
      : null;
  const common = meta?.common && typeof meta.common === "object" && !Array.isArray(meta.common) ? meta.common : {};
  const sched = String(common.availabilitySchedule || "").trim();
  if (!isWeeklyAvailabilityComplete(sched)) {
    return { required: false, dates: [], times: [], scheduleHuman: "", windowStart: "", windowEnd: "" };
  }
  const p = parseAvailabilitySchedule(sched);
  if (p.kind !== "weekly") return { required: false, dates: [], times: [], scheduleHuman: "", windowStart: "", windowEnd: "" };
  const dates = getBookableIsoDatesForWeekly(p, 120);
  const times = halfHourTimesBetween(p.start, p.end);
  return {
    required: true,
    dates,
    times,
    scheduleHuman: formatAvailabilityScheduleHuman(sched),
    windowStart: p.start,
    windowEnd: p.end,
  };
}

export function formatServiceBookingRequestLine(dateIso, timeHm) {
  return `Requested: ${String(dateIso || "").trim()} ${String(timeHm || "").trim()}`;
}

/** UI-only: each `Requested: YYYY-MM-DD HH:mm` segment → same ISO date + {@link formatTimeHmTo12HourLabel}. */
export function formatBuyerCommentRequestedSlotsForDisplay(comment) {
  const re = /Requested:\s*(\d{4}-\d{1,2}-\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?/gi;
  return String(comment ?? "").replace(re, (full, dateRaw, hRaw, mRaw) => {
    const d = normalizeBookingDateIso(dateRaw);
    const t = normalizeBookingTimeHm(`${hRaw}:${mRaw}`);
    if (!d || !t || !TIME_RE.test(t)) return full;
    return `Requested: ${d} ${formatTimeHmTo12HourLabel(t)}`;
  });
}

/** `HH:mm` (24h) → display like `1:00 PM` (12h, includes :30). */
export function formatTimeHmTo12HourLabel(hm) {
  if (!TIME_RE.test(String(hm || ""))) return String(hm || "").trim();
  const [h, m] = String(hm)
    .split(":")
    .map((x) => Number(x));
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** `YYYY-MM-DD` → short local label for calendar pickers. */
export function formatIsoDateForBookingDisplay(iso) {
  if (!ISO_DATE.test(String(iso || ""))) return String(iso || "").trim();
  const [y, mo, d] = String(iso)
    .split("-")
    .map((x) => Number(x));
  const dt = new Date(y, mo - 1, d);
  if (!Number.isFinite(dt.getTime())) return String(iso || "").trim();
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/**
 * True if this calendar day + slot start is not bookable anymore (day before today, or today with start time ≤ now).
 * Uses the viewer's local timezone.
 * @param {string} dateIso `YYYY-MM-DD` (any shape accepted by {@link normalizeBookingDateIso})
 * @param {string} timeHm `HH:mm` (any shape accepted by {@link normalizeBookingTimeHm})
 */
export function isServiceSlotElapsed(dateIso, timeHm) {
  const d = normalizeBookingDateIso(dateIso);
  const t = normalizeBookingTimeHm(timeHm);
  if (!d || !t || !TIME_RE.test(t)) return false;
  const [y, mo, day] = d.split("-").map((x) => Number(x));
  const slotDay = new Date(y, mo - 1, day);
  if (!Number.isFinite(slotDay.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (slotDay.getTime() < startOfToday.getTime()) return true;
  if (slotDay.getTime() > startOfToday.getTime()) return false;
  const [th, tm] = t.split(":").map((x) => Number(x));
  const slotStart = new Date(y, mo - 1, day, th, tm, 0, 0);
  return now.getTime() >= slotStart.getTime();
}

/** Normalize one `bookedSlots` API entry (camelCase or snake_case, various time shapes). */
export function normalizeBookedSlotEntry(x) {
  const date = normalizeBookingDateIso(x?.date ?? x?.service_booking_date ?? x?.serviceBookingDate);
  const time = normalizeBookingTimeHm(x?.time ?? x?.service_booking_time ?? x?.serviceBookingTime);
  if (!date || !time) return null;
  const status = String(x?.status ?? x?.order_status ?? "").trim().toLowerCase();
  return status ? { date, time, status } : { date, time };
}

/** @param {unknown} raw */
export function normalizeBookedSlotsArray(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const x of raw) {
    const n = normalizeBookedSlotEntry(x);
    if (n) out.push(n);
  }
  return out;
}

/** @param {{ date: string, time: string }[]} slots */
export function bookedSlotsToKeySet(slots) {
  const s = new Set();
  for (const b of slots || []) {
    const date = normalizeBookingDateIso(b?.date);
    const time = normalizeBookingTimeHm(b?.time);
    if (date && time) s.add(`${date}\t${time}`);
  }
  return s;
}

/**
 * @param {{ bookedSlotKeys?: Set<string> } | undefined} [extra]
 * @returns {string} empty string if valid, else user-facing error
 */
export function validateServiceBookingSelection(listingLike, dateIso, timeHm, extra) {
  const o = slotOptionsForServiceListing(listingLike);
  if (!o.required) return "";
  const d = normalizeBookingDateIso(String(dateIso || "").trim());
  const t = normalizeBookingTimeHm(timeHm);
  if (!d || !ISO_DATE.test(d)) return "Choose a booking date.";
  if (!o.dates.includes(d)) return "That date is outside the provider’s weekly availability.";
  if (!t || !TIME_RE.test(t)) return "Choose a booking time.";
  if (!bookingTimeHmWithinWindow(t, o.windowStart, o.windowEnd)) return "That time is outside the provider’s available hours.";
  if (isServiceSlotElapsed(d, t)) return "That time has already passed.";
  const keys = extra?.bookedSlotKeys;
  if (keys instanceof Set && keys.has(`${d}\t${t}`)) {
    return "That time is already booked. Choose another slot.";
  }
  return "";
}
