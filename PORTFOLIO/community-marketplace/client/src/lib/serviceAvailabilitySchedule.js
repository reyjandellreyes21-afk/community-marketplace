/** Weekly recurring availability stored as JSON: `{ v: 1, days: number[], start, end }` (days 0=Sun … 6=Sat). */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * @typedef {{ kind: 'empty' }} ParsedEmpty
 * @typedef {{ kind: 'weekly', days: number[], start: string, end: string }} ParsedWeekly
 * @typedef {{ kind: 'legacy_dates', raw: string }} ParsedLegacyDates
 * @typedef {{ kind: 'legacy_text', raw: string }} ParsedLegacyText
 */

/** @param {unknown} raw @returns {ParsedEmpty | ParsedWeekly | ParsedLegacyDates | ParsedLegacyText} */
export function parseAvailabilitySchedule(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { kind: "empty" };
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
      return { kind: "weekly", days: [...new Set(days)].sort((a, b) => a - b), start: j.start, end: j.end };
    }
  } catch {
    /* fall through */
  }
  const parts = s.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length > 0 && parts.every((p) => ISO_DATE.test(p))) {
    return { kind: "legacy_dates", raw: s };
  }
  return { kind: "legacy_text", raw: s };
}

/** @param {unknown} raw */
export function isWeeklyAvailabilityComplete(raw) {
  const p = parseAvailabilitySchedule(raw);
  if (p.kind !== "weekly") return false;
  if (!p.days.length) return false;
  if (!TIME_RE.test(p.start) || !TIME_RE.test(p.end)) return false;
  if (p.start >= p.end) return false;
  return true;
}

/**
 * @param {{ days: number[], start: string, end: string }} p
 * @returns {string}
 */
export function serializeWeeklyAvailability({ days, start, end }) {
  const uniq = [...new Set(days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
  return JSON.stringify({ v: 1, days: uniq, start, end });
}

/** @param {string} hhmm */
function formatTimeLabel(hhmm) {
  if (!TIME_RE.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** @param {number[]} days */
export function formatDaysHuman(days) {
  const sorted = [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  const groups = [];
  let runStart = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
    } else {
      groups.push([runStart, prev]);
      runStart = prev = cur;
    }
  }
  groups.push([runStart, prev]);
  return groups
    .map(([a, b]) => (a === b ? DAY_FULL[a] : `${DAY_FULL[a]} – ${DAY_FULL[b]}`))
    .join(", ");
}

/**
 * Human-readable line for previews (listing UI, booking copy).
 * Weekly schedules return **days + hours only** (no leading “Available”) so they sit cleanly next to labels like “Availability”.
 * @param {unknown} raw
 */
export function formatAvailabilityScheduleHuman(raw) {
  const p = parseAvailabilitySchedule(raw);
  if (p.kind === "weekly") {
    const daysHuman = formatDaysHuman(p.days);
    if (!daysHuman) return "";
    return `${daysHuman}, ${formatTimeLabel(p.start)} – ${formatTimeLabel(p.end)}`;
  }
  if (p.kind === "legacy_dates") {
    return "Previously saved as specific dates — set weekly hours below.";
  }
  if (p.kind === "legacy_text") return p.raw;
  return "";
}
