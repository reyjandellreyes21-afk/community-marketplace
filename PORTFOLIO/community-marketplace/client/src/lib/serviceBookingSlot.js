import {
  formatAvailabilityScheduleHuman,
  isWeeklyAvailabilityComplete,
  parseAvailabilitySchedule,
} from "./serviceAvailabilitySchedule.js";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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
 * @returns {{ required: boolean, dates: string[], times: string[], scheduleHuman: string }}
 */
export function slotOptionsForServiceListing(listingLike) {
  const meta =
    listingLike?.serviceMeta && typeof listingLike.serviceMeta === "object" && !Array.isArray(listingLike.serviceMeta)
      ? listingLike.serviceMeta
      : null;
  const common = meta?.common && typeof meta.common === "object" && !Array.isArray(meta.common) ? meta.common : {};
  const sched = String(common.availabilitySchedule || "").trim();
  if (!isWeeklyAvailabilityComplete(sched)) {
    return { required: false, dates: [], times: [], scheduleHuman: "" };
  }
  const p = parseAvailabilitySchedule(sched);
  if (p.kind !== "weekly") return { required: false, dates: [], times: [], scheduleHuman: "" };
  const dates = getBookableIsoDatesForWeekly(p, 120);
  const times = halfHourTimesBetween(p.start, p.end);
  return {
    required: true,
    dates,
    times,
    scheduleHuman: formatAvailabilityScheduleHuman(sched),
  };
}

export function formatServiceBookingRequestLine(dateIso, timeHm) {
  return `Requested: ${String(dateIso || "").trim()} ${String(timeHm || "").trim()}`;
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
 * @returns {string} empty string if valid, else user-facing error
 */
export function validateServiceBookingSelection(listingLike, dateIso, timeHm) {
  const o = slotOptionsForServiceListing(listingLike);
  if (!o.required) return "";
  const d = String(dateIso || "").trim();
  const t = String(timeHm || "").trim();
  if (!ISO_DATE.test(d)) return "Choose a booking date.";
  if (!o.dates.includes(d)) return "That date is outside the provider’s weekly availability.";
  if (!TIME_RE.test(t)) return "Choose a booking time.";
  if (!o.times.includes(t)) return "That time is outside the provider’s available hours.";
  return "";
}
