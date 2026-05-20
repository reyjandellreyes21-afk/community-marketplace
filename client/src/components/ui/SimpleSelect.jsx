import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";

/**
 * Styled dropdown — avoids native `<select>` OS menus (misaligned width, sharp corners, wrong borders).
 *
 * @param {object} props
 * @param {string} props.id — id for the trigger (pair with `<label htmlFor>`).
 * @param {string} props.value
 * @param {(next: string) => void} props.onChange
 * @param {{ value: string; label: string }[]} props.options
 * @param {string} [props.className] — outer wrapper (width/layout).
 * @param {string} [props.triggerClassName] — merged into the trigger button (e.g. rounded-full, shadow).
 */
export function SimpleSelect({ id, value, onChange, options, className, triggerClassName }) {
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 0;
    const panelHeight = Math.min(viewportHeight * 0.65, 420);
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    setOpenUpward(spaceBelow < panelHeight && spaceAbove > spaceBelow);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative", open && "z-[350]", className)}
    >
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          "input-base flex w-full min-w-0 items-center justify-between gap-2 py-2 pl-3 pr-2.5 text-left text-sm md:h-10 md:min-h-0",
          open && "border-brand-primary ring-1 ring-brand-primary/35 dark:border-brand-accent dark:ring-brand-accent/30",
          triggerClassName,
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        <svg
          className={cn("h-4 w-4 shrink-0 text-neutral-600 transition-transform dark:text-slate-400", open && "rotate-180")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={listboxId}
          role="listbox"
          aria-label="Sort options"
          className={cn(
            "absolute left-0 right-0 z-[360] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_16px_48px_-8px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.06] dark:border-[#3d6d8f]/45 dark:bg-[#0f2234] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.55)] dark:ring-white/[0.08]",
            openUpward ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          <div className="flex max-h-[min(65dvh,26rem)] flex-col overflow-y-auto p-1">
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "flex w-full min-h-[2.5rem] items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition",
                    active
                      ? "bg-brand-soft/90 text-brand-primary dark:bg-slate-800/90 dark:text-brand-accent"
                      : "text-neutral-800 hover:bg-neutral-50 dark:text-slate-100 dark:hover:bg-slate-800/80",
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
