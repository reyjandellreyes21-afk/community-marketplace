import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  bookingTimeHmWithinWindow,
  formatIsoDateForBookingDisplay,
  formatTimeHmTo12HourLabel,
  isServiceSlotElapsed,
  normalizeBookingDateIso,
  normalizeBookingTimeHm,
  parseUserTimeInputToHm,
} from "../../lib/serviceBookingSlot.js";

const NO_TIMES = Object.freeze([]);

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** @param {string} iso */
function parseIsoLocal(iso) {
  const m = String(iso || "").match(ISO);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return { y, m0: mo, d, iso: `${String(y).padStart(4, "0")}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

/** @param {number} y @param {number} m0 0-11 @param {number} day */
function toIso(y, m0, day) {
  const dt = new Date(y, m0, day);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function monthCells(y, m0) {
  const first = new Date(y, m0, 1);
  const pad = first.getDay();
  const lastDay = new Date(y, m0 + 1, 0).getDate();
  const cells = [];
  let i = 1 - pad;
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      if (i < 1 || i > lastDay) cells.push(null);
      else cells.push(toIso(y, m0, i));
      i += 1;
    }
  }
  return cells;
}

const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** @param {Set<string>} bookedKeySet composite keys `${date}\t${time}` matching the picker grid */
function takenTimesForDayFromBookedKeys(bookedKeySet, dayIso) {
  const d = normalizeBookingDateIso(dayIso);
  if (!d || !(bookedKeySet instanceof Set) || bookedKeySet.size === 0) return [];
  const prefix = `${d}\t`;
  const acc = [];
  for (const k of bookedKeySet) {
    if (typeof k !== "string" || !k.startsWith(prefix)) continue;
    const tm = normalizeBookingTimeHm(k.slice(prefix.length));
    if (tm) acc.push(tm);
  }
  return [...new Set(acc)].sort();
}

/**
 * @param {{
 *   scheduleHuman?: string;
 *   bookableDates: string[];
 *   slotTimes: string[];
 *   windowStartHm?: string;
 *   windowEndHm?: string;
 *   bookedSlots: { date: string; time: string; status?: string }[];
 *   selectedDate: string;
 *   selectedTime: string;
 *   onSelectDate: (iso: string) => void;
 *   onSelectTime: (hm: string) => void;
 *   disabled?: boolean;
 *   dateHint?: string;
 *   occupancyStale?: boolean;
 *   occupancyLoading?: boolean;
 *   occupancyLive?: boolean;
 *   onRetryOccupancy?: () => void;
 * }} props
 */
export function ServiceBookingPicker({
  scheduleHuman = "",
  bookableDates,
  slotTimes,
  windowStartHm = "",
  windowEndHm = "",
  bookedSlots,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  disabled = false,
  dateHint = "",
  occupancyStale = false,
  occupancyLoading = false,
  occupancyLive = false,
}) {
  const selDay = useMemo(() => normalizeBookingDateIso(String(selectedDate || "").trim()), [selectedDate]);
  const availabilityFresh = Boolean(occupancyLive && !occupancyStale && !occupancyLoading);
  const availabilitySnapshotStale = Boolean(occupancyLive && occupancyStale);
  const occupancyPending = Boolean(occupancyLoading && !occupancyLive);

  const bookableSet = useMemo(
    () =>
      new Set(
        (bookableDates || [])
          .map((x) => normalizeBookingDateIso(String(x || "").trim()))
          .filter(Boolean),
      ),
    [bookableDates],
  );
  const times = Array.isArray(slotTimes) ? slotTimes : NO_TIMES;

  const windowStartResolved = useMemo(() => {
    const w = String(windowStartHm || "").trim();
    if (w) return normalizeBookingTimeHm(w) || w;
    return times[0] ? normalizeBookingTimeHm(times[0]) : "";
  }, [windowStartHm, times]);

  const windowEndResolved = useMemo(() => {
    const w = String(windowEndHm || "").trim();
    if (w) return normalizeBookingTimeHm(w) || w;
    if (!times.length) return "";
    const last = normalizeBookingTimeHm(times[times.length - 1]);
    if (!last) return "";
    const [h, m] = last.split(":").map(Number);
    let mins = h * 60 + m + 30;
    const eh = Math.floor(mins / 60);
    const em = mins % 60;
    return `${String(Math.min(eh, 23)).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }, [windowEndHm, times]);

  const bookedKeySet = useMemo(() => {
    const s = new Set();
    for (const b of bookedSlots || []) {
      const date = normalizeBookingDateIso(b?.date);
      const time = normalizeBookingTimeHm(b?.time);
      if (date && time) s.add(`${date}\t${time}`);
    }
    return s;
  }, [bookedSlots]);

  /**
   * Booked keys from props drive the calendar; treat them as authoritative even if `occupancyLive`
   * has not flipped yet (avoids “after availability loads” while taken slots are already in state).
   */
  const treatBookedAsKnown = Boolean(occupancyLive || availabilitySnapshotStale || bookedKeySet.size > 0);

  const freeCountForDate = (iso) => {
    const isoN = normalizeBookingDateIso(iso);
    if (!isoN || !bookableSet.has(isoN)) return 0;
    let n = 0;
    for (const t of times) {
      if (bookedKeySet.has(`${isoN}\t${t}`)) continue;
      if (isServiceSlotElapsed(isoN, t)) continue;
      n += 1;
    }
    return n;
  };

  const dateMin = bookableDates?.[0] || "";
  const dateMax = bookableDates?.length ? bookableDates[bookableDates.length - 1] : "";

  const minParts = useMemo(() => parseIsoLocal(dateMin), [dateMin]);
  const maxParts = useMemo(() => parseIsoLocal(dateMax), [dateMax]);

  const [visible, setVisible] = useState(() => {
    const p = parseIsoLocal(normalizeBookingDateIso(selectedDate)) || minParts;
    return p ? { y: p.y, m0: p.m0 } : { y: new Date().getFullYear(), m0: new Date().getMonth() };
  });

  useEffect(() => {
    const p = parseIsoLocal(normalizeBookingDateIso(selectedDate));
    if (p) setVisible({ y: p.y, m0: p.m0 });
  }, [selectedDate]);

  const [takenModalIso, setTakenModalIso] = useState(null);
  const [timeDraft, setTimeDraft] = useState("");
  const [typedTimeError, setTypedTimeError] = useState("");

  const cells = useMemo(() => monthCells(visible.y, visible.m0), [visible.y, visible.m0]);

  const monthLabel = useMemo(() => {
    const dt = new Date(visible.y, visible.m0, 1);
    return dt.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [visible.y, visible.m0]);

  const canPrev = useMemo(() => {
    if (!minParts) return false;
    return visible.y > minParts.y || (visible.y === minParts.y && visible.m0 > minParts.m0);
  }, [visible, minParts]);

  const canNext = useMemo(() => {
    if (!maxParts) return false;
    return visible.y < maxParts.y || (visible.y === maxParts.y && visible.m0 < maxParts.m0);
  }, [visible, maxParts]);

  const bumpMonth = (delta) => {
    setVisible((v) => {
      const d = new Date(v.y, v.m0 + delta, 1);
      return { y: d.getFullYear(), m0: d.getMonth() };
    });
  };

  const timeAllowedOnDay = useCallback(
    (dateIso, hm) => {
      const d = normalizeBookingDateIso(dateIso);
      const t = normalizeBookingTimeHm(hm);
      if (!d || !t || !bookableSet.has(d)) return false;
      if (!windowStartResolved || !windowEndResolved) return false;
      if (!bookingTimeHmWithinWindow(t, windowStartResolved, windowEndResolved)) return false;
      if (isServiceSlotElapsed(d, t)) return false;
      if (bookedKeySet.has(`${d}\t${t}`)) return false;
      if (occupancyPending) return false;
      return true;
    },
    [bookableSet, windowStartResolved, windowEndResolved, bookedKeySet, occupancyPending],
  );

  const openTimesForSelected = useMemo(() => {
    if (!selDay || !bookableSet.has(selDay)) return [];
    if (occupancyPending) return [];
    return times.filter((t) => timeAllowedOnDay(selDay, t));
  }, [selDay, bookableSet, times, timeAllowedOnDay, occupancyPending]);

  useEffect(() => {
    const t = normalizeBookingTimeHm(selectedTime);
    setTimeDraft(t ? formatTimeHmTo12HourLabel(t) : "");
    setTypedTimeError("");
  }, [selectedTime, selDay]);

  useLayoutEffect(() => {
    if (!selDay || !bookableSet.has(selDay)) return;
    const tNorm = normalizeBookingTimeHm(selectedTime);
    if (tNorm && timeAllowedOnDay(selDay, tNorm)) return;
    const first = times.find((tm) => timeAllowedOnDay(selDay, tm));
    if (!first) {
      onSelectTime("");
      return;
    }
    onSelectTime(first);
  }, [selDay, selectedTime, bookedKeySet, bookableSet, times, onSelectTime, timeAllowedOnDay, occupancyPending]);

  const commitTypedTime = useCallback(() => {
    if (!selDay || !bookableSet.has(selDay)) return;
    if (occupancyPending) {
      setTypedTimeError("Availability is still loading. Wait a moment, then try again.");
      return;
    }
    const hm = parseUserTimeInputToHm(timeDraft);
    if (!hm) {
      setTypedTimeError("Enter a time like 8:30 AM or 14:15.");
      return;
    }
    if (!timeAllowedOnDay(selDay, hm)) {
      if (bookedKeySet.has(`${selDay}\t${hm}`)) {
        setTypedTimeError("That time is already held. Pick another.");
        return;
      }
      if (isServiceSlotElapsed(selDay, hm)) {
        setTypedTimeError("That time has already passed.");
        return;
      }
      setTypedTimeError("That time is outside the provider’s hours for this day.");
      return;
    }
    setTypedTimeError("");
    onSelectTime(hm);
  }, [selDay, bookableSet, timeDraft, timeAllowedOnDay, bookedKeySet, onSelectTime, occupancyPending]);

  const modalTakenList = useMemo(
    () => (takenModalIso ? takenTimesForDayFromBookedKeys(bookedKeySet, takenModalIso) : []),
    [bookedKeySet, takenModalIso],
  );

  useEffect(() => {
    if (!takenModalIso || typeof document === "undefined") return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setTakenModalIso(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [takenModalIso]);

  return (
    <div className="space-y-3">
      {scheduleHuman ? <p className="text-[11px] text-neutral-600 dark:text-slate-400">{scheduleHuman}</p> : null}

      {availabilitySnapshotStale ? (
        <p className="rounded-lg border border-amber-300/90 bg-amber-50/95 px-2.5 py-2 text-[10px] font-medium text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-100">
          Showing last loaded availability. Another buyer may have booked since — reopen this screen to refresh.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-x-3 gap-y-2 rounded-xl border border-neutral-200/90 bg-gradient-to-r from-slate-50/95 to-white px-2.5 py-2 text-[10px] font-semibold dark:border-slate-600/80 dark:from-slate-900/80 dark:to-slate-950/90">
        <span className="inline-flex items-center gap-1.5 text-violet-800 dark:text-violet-200">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ${
              availabilityFresh ? "bg-emerald-500 shadow-emerald-500/40" : "bg-sky-500 shadow-sky-500/35"
            }`}
            aria-hidden
          />
          {availabilityFresh ? "Live availability" : "On schedule"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-teal-900 dark:text-teal-100">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-500 shadow-sm shadow-teal-500/35 ring-2 ring-teal-300/80 dark:ring-teal-500/50" aria-hidden />
          Selected day
        </span>
        <span className="inline-flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 shadow-sm shadow-amber-400/40 ring-2 ring-amber-200/90 dark:bg-amber-500 dark:ring-amber-700/50" aria-hidden />
          Full day
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300 ring-2 ring-slate-200/90 dark:bg-slate-600 dark:ring-slate-700/80" aria-hidden />
          Off schedule
        </span>
      </div>

      <div
        className={`rounded-xl border border-neutral-200/90 bg-white/95 p-2 shadow-sm dark:border-slate-600/80 dark:bg-slate-950/50 ${
          availabilityFresh ? "ring-1 ring-emerald-200/70 dark:ring-emerald-800/40" : "ring-1 ring-slate-200/70 dark:ring-slate-700/50"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200/90 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-800/80"
            disabled={disabled || !canPrev}
            onClick={() => bumpMonth(-1)}
            aria-label="Previous month"
          >
            ←
          </button>
          <p className="min-w-0 truncate text-center text-xs font-semibold text-neutral-900 dark:text-slate-100">{monthLabel}</p>
          <button
            type="button"
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200/90 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-800/80"
            disabled={disabled || !canNext}
            onClick={() => bumpMonth(1)}
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center" role="grid" aria-label="Bookable dates">
          {WEEK_LABELS.map((w) => (
            <div key={w} className="py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-500">
              {w}
            </div>
          ))}
          {cells.map((iso, idx) => {
            if (!iso) {
              return <div key={`e-${idx}`} className="aspect-square min-h-[2.25rem]" />;
            }
            const isoN = normalizeBookingDateIso(iso);
            const bookable = isoN ? bookableSet.has(isoN) : false;
            const free = bookable ? freeCountForDate(iso) : 0;
            const selected = Boolean(selDay && isoN && isoN === selDay);
            const hasOpen = bookable && free > 0 && !occupancyPending;
            const isFullDay = bookable && free === 0;

            const base =
              "relative flex aspect-square min-h-[2.25rem] w-full flex-col items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/55 dark:focus-visible:ring-teal-400/50";
            const offCls =
              "cursor-default text-slate-400 ring-1 ring-inset ring-slate-200/80 bg-slate-50/80 dark:bg-slate-900/40 dark:text-slate-600 dark:ring-slate-700/60";
            const openLiveCls =
              "cursor-pointer text-emerald-950 ring-1 ring-inset ring-emerald-400/95 bg-gradient-to-b from-emerald-100 to-emerald-200 hover:from-emerald-200 hover:to-emerald-300 dark:from-emerald-950/60 dark:to-emerald-900/50 dark:text-emerald-50 dark:ring-emerald-500/55";
            const openSnapshotCls =
              "cursor-pointer text-sky-950 ring-1 ring-inset ring-sky-300/90 bg-gradient-to-b from-sky-50 to-sky-100/95 hover:from-sky-100 hover:to-sky-200 dark:from-sky-950/45 dark:to-sky-900/40 dark:text-sky-50 dark:ring-sky-600/45";
            const openScheduleCls =
              "cursor-pointer text-indigo-950 ring-1 ring-inset ring-indigo-200/95 bg-gradient-to-b from-indigo-50/95 to-violet-50/90 hover:from-indigo-100 hover:to-violet-100 dark:from-indigo-950/40 dark:to-violet-950/35 dark:text-indigo-100 dark:ring-indigo-700/45";
            const pickedDayCls =
              "cursor-pointer bg-gradient-to-br from-teal-500 to-cyan-600 text-white ring-2 ring-teal-400 ring-offset-2 ring-offset-white shadow-lg hover:from-teal-600 hover:to-cyan-700 dark:from-teal-400 dark:to-cyan-500 dark:text-slate-950 dark:ring-teal-300 dark:ring-offset-slate-950";
            const fullCls =
              "cursor-pointer text-amber-950 ring-1 ring-inset ring-amber-300/95 bg-gradient-to-b from-amber-100 to-orange-50 hover:from-amber-200 hover:to-orange-100 dark:from-amber-950/50 dark:to-orange-950/35 dark:text-amber-50 dark:ring-amber-600/50";

            const dayNum = Number(iso.slice(8, 10));
            const clickable = bookable && !disabled;

            let daySurface = offCls;
            if (!bookable) {
              daySurface = offCls;
            } else if (selected && hasOpen) {
              daySurface = pickedDayCls;
            } else if (selected && isFullDay) {
              daySurface = pickedDayCls;
            } else if (selected && occupancyPending) {
              daySurface = pickedDayCls;
            } else if (hasOpen) {
              if (availabilityFresh) daySurface = openLiveCls;
              else if (availabilitySnapshotStale) daySurface = openSnapshotCls;
              else daySurface = openScheduleCls;
            } else if (isFullDay) {
              daySurface = fullCls;
            } else if (occupancyPending) {
              daySurface = openScheduleCls;
            }

            return (
              <button
                key={iso}
                type="button"
                role="gridcell"
                disabled={!clickable}
                aria-pressed={selected}
                aria-current={selected && bookable ? "date" : undefined}
                aria-label={
                  bookable
                    ? occupancyPending
                      ? `${formatIsoDateForBookingDisplay(iso)}, checking taken slots${selected ? ", selected" : ""}`
                      : free > 0
                        ? `${formatIsoDateForBookingDisplay(iso)}, ${free} quick-pick slots open${selected ? ", selected" : ""}`
                        : `${formatIsoDateForBookingDisplay(iso)}, day full on quick picks — you may still type a time in range${selected ? ", selected" : ""}`
                    : `${dayNum}, not an available weekday`
                }
                className={`${base} ${daySurface} ${!clickable && !selected ? "opacity-80" : ""}`}
                onClick={() => {
                  if (!clickable) return;
                  if (isoN && selDay === isoN) {
                    setTakenModalIso(isoN);
                    return;
                  }
                  setTakenModalIso(null);
                  onSelectDate(iso);
                }}
              >
                <span>{dayNum}</span>
                {bookable && hasOpen && !selected ? (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${
                      availabilityFresh ? "bg-emerald-700 dark:bg-emerald-300" : "bg-slate-600 dark:bg-slate-300"
                    }`}
                    aria-hidden
                  />
                ) : null}
                {bookable && isFullDay ? (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-amber-600 dark:bg-amber-400" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium text-neutral-700 dark:text-slate-300">
          {selDay ? (
            <>
              Selected day:{" "}
              <span className="font-semibold text-neutral-900 dark:text-slate-100">{formatIsoDateForBookingDisplay(selDay)}</span>
            </>
          ) : (
            "Pick a day above."
          )}
        </p>
        {dateHint ? <p className="text-[10px] text-rose-600 dark:text-rose-400">{dateHint}</p> : null}
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium text-neutral-700 dark:text-slate-300">Start time</p>
        <label className="block min-w-0" htmlFor="booking-typed-time">
          <span className="mb-0.5 block text-[10px] font-medium text-neutral-500 dark:text-slate-500">
            Type a time (e.g. 8:34am, 2:15 PM) within the provider&apos;s hours
          </span>
          <div className="flex flex-wrap gap-2">
            <input
              id="booking-typed-time"
              type="text"
              autoComplete="off"
              className="input-base min-w-[9rem] flex-1 text-sm"
              disabled={disabled || !selDay || !bookableSet.has(selDay) || occupancyPending}
              placeholder="e.g. 9:00 AM"
              value={timeDraft}
              onChange={(e) => setTimeDraft(e.target.value)}
              onBlur={() => commitTypedTime()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTypedTime();
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary min-h-10 shrink-0 px-3 text-xs font-semibold"
              disabled={disabled || !selDay || !bookableSet.has(selDay) || occupancyPending}
              onClick={() => commitTypedTime()}
            >
              Apply
            </button>
          </div>
        </label>
        {typedTimeError ? (
          <p className="mt-1 text-[10px] font-medium text-rose-600 dark:text-rose-400" role="alert">
            {typedTimeError}
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-neutral-700 dark:text-slate-300">Quick picks (30 min)</p>
        {openTimesForSelected.length === 0 && selDay && bookableSet.has(selDay) && !occupancyPending ? (
          <p className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
            {treatBookedAsKnown
              ? "No free half-hour quick picks — try typing an exact start time above."
              : "No quick picks left today — choose another day or type a time."}
          </p>
        ) : null}
        {selectedDate && (!selDay || !bookableSet.has(selDay)) ? (
          <p className="text-[10px] text-neutral-500 dark:text-slate-500">This day is not on the provider&apos;s schedule.</p>
        ) : null}
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Time quick picks for selected day">
          {(() => {
            if (!selDay || !bookableSet.has(selDay)) return null;
            return openTimesForSelected.map((t) => {
              const label = formatTimeHmTo12HourLabel(t);
              const active = t === normalizeBookingTimeHm(selectedTime);
              return (
                <button
                  key={t}
                  type="button"
                  role="listitem"
                  disabled={disabled}
                  onClick={() => {
                    setTypedTimeError("");
                    onSelectTime(t);
                  }}
                  className={`min-h-[2.25rem] rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tabular-nums ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/45 dark:focus-visible:ring-teal-400/45 ${
                    active
                      ? "bg-gradient-to-br from-teal-500 to-cyan-600 text-white ring-teal-500 shadow-md dark:from-teal-400 dark:to-cyan-500 dark:text-slate-950 dark:ring-teal-400"
                      : "bg-white text-neutral-800 ring-neutral-200/90 hover:bg-neutral-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600 dark:hover:bg-slate-800/90"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {label}
                </button>
              );
            });
          })()}
        </div>
      </div>

      {takenModalIso ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-taken-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/55 backdrop-blur-[2px] dark:bg-black/60"
            aria-label="Close"
            onClick={() => setTakenModalIso(null)}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="booking-taken-modal-title" className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                Booked times — {formatIsoDateForBookingDisplay(takenModalIso)}
              </h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-800"
                onClick={() => setTakenModalIso(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-3 max-h-[min(50dvh,20rem)] overflow-y-auto">
              {modalTakenList.length > 0 ? (
                <ul className="space-y-1 text-sm font-medium text-neutral-800 dark:text-slate-200">
                  {modalTakenList.map((tm) => (
                    <li key={tm} className="tabular-nums rounded-lg bg-neutral-100/90 px-2 py-1.5 dark:bg-slate-800/90">
                      {formatTimeHmTo12HourLabel(tm)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-600 dark:text-slate-400">
                  {treatBookedAsKnown ? "No booked slots on this day in the latest data." : "Taken times appear after availability loads."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
