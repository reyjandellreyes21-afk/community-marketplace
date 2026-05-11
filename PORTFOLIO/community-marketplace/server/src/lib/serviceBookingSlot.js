/**
 * Server-side validation for service booking date/time (mirrors client `serviceBookingSlot.js`).
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseWeeklyFromScheduleJson(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const j = JSON.parse(s);
    if (
      j &&
      typeof j === "object" &&
      j.v === 1 &&
      Array.isArray(j.days) &&
      typeof j.start === "string" &&
      typeof j.end === "string"
    ) {
      const days = j.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      return { days: [...new Set(days)].sort((a, b) => a - b), start: j.start, end: j.end };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function isWeeklyCompleteFromRaw(raw) {
  const p = parseWeeklyFromScheduleJson(raw);
  if (!p || !p.days.length) return false;
  if (!TIME_RE.test(p.start) || !TIME_RE.test(p.end)) return false;
  return p.start < p.end;
}

function toIsoDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getBookableIsoDatesForWeekly(parsedWeekly, maxDays = 120) {
  const allowed = new Set(parsedWeekly.days);
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

function halfHourTimesBetween(start, end) {
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

function slotOptionsFromListingRow(listing) {
  const meta =
    listing?.service_meta != null && typeof listing.service_meta === "object" && !Array.isArray(listing.service_meta)
      ? listing.service_meta
      : listing?.serviceMeta != null && typeof listing.serviceMeta === "object" && !Array.isArray(listing.serviceMeta)
        ? listing.serviceMeta
        : null;
  const common = meta?.common && typeof meta.common === "object" && !Array.isArray(meta.common) ? meta.common : {};
  const sched = String(common.availabilitySchedule || "").trim();
  if (!isWeeklyCompleteFromRaw(sched)) {
    return { required: false, dates: [], times: [] };
  }
  const p = parseWeeklyFromScheduleJson(sched);
  if (!p) return { required: false, dates: [], times: [] };
  return {
    required: true,
    dates: getBookableIsoDatesForWeekly(p, 120),
    times: halfHourTimesBetween(p.start, p.end),
  };
}

/**
 * @returns {string} non-empty error message, or "" if OK / not required
 */
export function validateServiceBookingSlotForOrder(listingRow, dateIso, timeHm) {
  const o = slotOptionsFromListingRow(listingRow);
  if (!o.required) return "";
  const d = String(dateIso || "").trim();
  const t = String(timeHm || "").trim();
  if (!ISO_DATE.test(d)) return "Choose a booking date that matches the provider’s schedule.";
  if (!o.dates.includes(d)) return "That date is outside the provider’s weekly availability.";
  if (!TIME_RE.test(t)) return "Choose a booking time.";
  if (!o.times.includes(t)) return "That time is outside the provider’s available hours.";
  return "";
}

export function formatServiceBookingRequestLine(dateIso, timeHm) {
  return `Requested: ${String(dateIso || "").trim()} ${String(timeHm || "").trim()}`;
}
