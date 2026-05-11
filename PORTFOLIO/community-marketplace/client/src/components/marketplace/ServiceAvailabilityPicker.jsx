import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatAvailabilityScheduleHuman,
  parseAvailabilitySchedule,
  serializeWeeklyAvailability,
} from "../../lib/serviceAvailabilitySchedule.js";

const DAY_PAD = [
  { dow: 0, short: "Su", label: "Sun" },
  { dow: 1, short: "Mo", label: "Mon" },
  { dow: 2, short: "Tu", label: "Tue" },
  { dow: 3, short: "We", label: "Wed" },
  { dow: 4, short: "Th", label: "Thu" },
  { dow: 5, short: "Fr", label: "Fri" },
  { dow: 6, short: "Sa", label: "Sat" },
];

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

function sameDaySet(selected, preset) {
  const a = [...new Set(selected)].sort((x, y) => x - y);
  const b = [...new Set(preset)].sort((x, y) => x - y);
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

const presetButtonBase =
  "rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/70 dark:focus-visible:ring-offset-slate-950";
const presetButtonIdle =
  "border-neutral-200/90 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800";
const presetButtonActive =
  "border-brand-primary bg-brand-primary/12 text-brand-primary dark:border-brand-accent dark:bg-brand-accent/15 dark:text-brand-accent";

/**
 * Recurring weekly hours (days + start/end time).
 * Stored value: JSON string `{ v: 1, days: number[], start: "HH:mm", end: "HH:mm" }`.
 */
export function ServiceAvailabilityPicker({
  value,
  onChange,
  invalid,
  legendId = "service-availability-legend",
  /** When true, title is screen-reader only (use an external trigger button). */
  hideLegend = false,
}) {
  const parsed = useMemo(() => parseAvailabilitySchedule(value), [value]);

  const daysSelected = useMemo(() => {
    if (parsed.kind === "weekly") return parsed.days;
    return [];
  }, [parsed]);

  const [times, setTimes] = useState(() =>
    parsed.kind === "weekly" ? { start: parsed.start, end: parsed.end } : { start: "08:00", end: "20:00" },
  );

  useEffect(() => {
    const p = parseAvailabilitySchedule(value);
    if (p.kind === "weekly") {
      setTimes({ start: p.start, end: p.end });
    }
  }, [value]);

  const legacyNote = useMemo(() => {
    if (parsed.kind === "legacy_dates") {
      return "This listing used specific calendar dates. Set your usual weekly hours below; they will replace the old schedule when you save.";
    }
    if (parsed.kind === "legacy_text") {
      return `Previously saved as free text: "${parsed.raw}". Use the fields below to replace it when you save.`;
    }
    return "";
  }, [parsed]);

  const commit = useCallback(
    (nextDays, t) => {
      if (!nextDays.length) {
        onChange("");
        return;
      }
      onChange(serializeWeeklyAvailability({ days: nextDays, start: t.start, end: t.end }));
    },
    [onChange],
  );

  const toggleDay = useCallback(
    (dow) => {
      const set = new Set(daysSelected);
      if (set.has(dow)) set.delete(dow);
      else set.add(dow);
      const next = [...set].sort((a, b) => a - b);
      commit(next, times);
    },
    [commit, daysSelected, times],
  );

  const applyPreset = useCallback(
    (preset) => {
      commit([...preset].sort((a, b) => a - b), times);
    },
    [commit, times],
  );

  const onStartChange = useCallback(
    (e) => {
      const v = e.target.value;
      const next = { ...times, start: v };
      setTimes(next);
      if (daysSelected.length) commit(daysSelected, next);
    },
    [commit, daysSelected, times],
  );

  const onEndChange = useCallback(
    (e) => {
      const v = e.target.value;
      const next = { ...times, end: v };
      setTimes(next);
      if (daysSelected.length) commit(daysSelected, next);
    },
    [commit, daysSelected, times],
  );

  const previewHuman = useMemo(() => {
    if (!daysSelected.length) return "";
    return formatAvailabilityScheduleHuman(
      serializeWeeklyAvailability({ days: daysSelected, start: times.start, end: times.end }),
    );
  }, [daysSelected, times.start, times.end]);

  const timeOrderWarning =
    daysSelected.length > 0 && times.start && times.end && times.start >= times.end
      ? "End time must be after start time (same calendar day; overnight hours are not supported yet)."
      : "";

  const presetWeekdaysOn = sameDaySet(daysSelected, WEEKDAYS);
  const presetWeekendOn = sameDaySet(daysSelected, WEEKEND);
  const presetEveryOn = sameDaySet(daysSelected, EVERY_DAY);

  return (
    <fieldset
      className={`min-w-0 border-0 p-0 ${invalid ? "rounded-xl ring-2 ring-rose-400/90 ring-offset-2 ring-offset-white dark:ring-offset-slate-950" : ""}`}
    >
      <legend id={legendId} className={`mb-1.5 w-full text-left ${hideLegend ? "sr-only" : ""}`}>
        <span className="label-base">Availability schedule (optional)</span>
      </legend>
      <p className="mb-3 text-[11px] leading-snug text-neutral-500 dark:text-slate-400">
        Example: Monday – Friday, 8:00 AM – 8:00 PM. Choose recurring days and your daily window.
      </p>

      {legacyNote ? (
        <p className="mb-3 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
          {legacyNote}
        </p>
      ) : null}

      <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-slate-600 dark:bg-slate-900/80 dark:shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-slate-400">Days</p>
          <span className="hidden text-[10px] text-neutral-400 sm:inline dark:text-slate-500">Tap a day to toggle</span>
        </div>
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={presetWeekdaysOn}
            className={`${presetButtonBase} ${presetWeekdaysOn ? presetButtonActive : presetButtonIdle}`}
            onClick={() => applyPreset(WEEKDAYS)}
          >
            Mon–Fri
          </button>
          <button
            type="button"
            aria-pressed={presetWeekendOn}
            className={`${presetButtonBase} ${presetWeekendOn ? presetButtonActive : presetButtonIdle}`}
            onClick={() => applyPreset(WEEKEND)}
          >
            Weekend
          </button>
          <button
            type="button"
            aria-pressed={presetEveryOn}
            className={`${presetButtonBase} ${presetEveryOn ? presetButtonActive : presetButtonIdle}`}
            onClick={() => applyPreset(EVERY_DAY)}
          >
            Every day
          </button>
        </div>
        <p className="mb-3 text-[10px] leading-snug text-neutral-500 dark:text-slate-500">
          Quick picks replace your current selection (they do not add to it).
        </p>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="group" aria-label="Days of the week">
          {DAY_PAD.map(({ dow, short, label }) => {
            const on = daysSelected.includes(dow);
            return (
              <button
                key={dow}
                type="button"
                aria-pressed={on}
                aria-label={label}
                title={label}
                onClick={() => toggleDay(dow)}
                className={`flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/70 dark:focus-visible:ring-offset-slate-950 sm:min-h-[3.25rem] ${
                  on
                    ? "border-brand-primary bg-brand-primary text-white shadow-md shadow-brand-primary/20 dark:border-brand-accent dark:bg-brand-accent dark:text-slate-900 dark:shadow-brand-accent/25"
                    : "border-neutral-200/90 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide opacity-95">{short}</span>
                <span
                  className={`hidden text-[9px] font-medium leading-none sm:inline ${on ? "text-white/95 dark:text-slate-900/90" : "text-neutral-500 dark:text-slate-400"}`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 border-t border-neutral-200/80 pt-4 dark:border-slate-600">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-slate-400">Hours</p>
          <p className="mb-2.5 text-[10px] leading-snug text-neutral-500 dark:text-slate-500">
            Same window for every selected day. End must be after start on the same calendar day (overnight spans are not supported yet).
            {!daysSelected.length ? (
              <span className="block pt-1 text-neutral-600 dark:text-slate-400">
                Select at least one day above — then your hours are saved with this listing.
              </span>
            ) : null}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0">
              <label
                htmlFor="service-availability-start"
                className="mb-1.5 block text-xs font-semibold text-neutral-600 dark:text-slate-400"
              >
                Start
              </label>
              <input
                id="service-availability-start"
                type="time"
                value={times.start}
                onChange={onStartChange}
                className="input-base h-10 w-full min-w-0 py-2 text-sm"
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor="service-availability-end"
                className="mb-1.5 block text-xs font-semibold text-neutral-600 dark:text-slate-400"
              >
                End
              </label>
              <input
                id="service-availability-end"
                type="time"
                value={times.end}
                onChange={onEndChange}
                className="input-base h-10 w-full min-w-0 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {timeOrderWarning ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" role="status">
            {timeOrderWarning}
          </p>
        ) : null}

        <div className="mt-4 border-t border-neutral-200/80 pt-3 dark:border-slate-600">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400 dark:text-slate-500">Summary</p>
          {previewHuman ? (
            <p className="mt-1.5 border-l-[3px] border-brand-primary/85 pl-2.5 text-sm font-medium leading-snug text-neutral-900 dark:border-brand-accent dark:text-slate-100">
              {previewHuman}
            </p>
          ) : (
            <p className="mt-1.5 text-xs leading-snug text-neutral-500 dark:text-slate-400">
              Your schedule line appears here once you choose days (and valid hours).
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}
