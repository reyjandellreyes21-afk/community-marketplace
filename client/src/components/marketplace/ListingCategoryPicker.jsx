import { useEffect, useId, useMemo, useRef, useState } from "react";
import { VERTICALS } from "../../categoryNav.js";
import { categoryIcon } from "../browse/BrowseFilterIcons.jsx";

/**
 * @param {object} props
 * @param {string} props.value — selected vertical id or ""
 * @param {(id: string) => void} props.onChange
 * @param {boolean} [props.invalid]
 */
export function ListingCategoryPicker({ value, onChange, invalid }) {
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const triggerId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => VERTICALS.find((v) => v.id === value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return VERTICALS;
    return VERTICALS.filter((v) => v.label.toLowerCase().includes(q) || v.id.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const triggerRing = invalid
    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30"
    : "border-neutral-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 dark:border-slate-600 dark:focus:border-brand-primary dark:focus:ring-brand-primary/25";

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={triggerId} className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-slate-300">
        Categories *
      </label>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-invalid={invalid || undefined}
        className={`input-base flex w-full items-center justify-between gap-2 text-left ${triggerRing}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`flex min-w-0 items-center gap-2 ${value ? "text-neutral-900 dark:text-slate-100" : "text-neutral-400 dark:text-slate-500"}`}>
          {selected ? (
            <>
              <span className="shrink-0 text-base leading-none" aria-hidden>
                {categoryIcon(selected.id)}
              </span>
              <span className="truncate font-medium">{selected.label}</span>
            </>
          ) : (
            <span className="font-normal">Choose the best category for your item</span>
          )}
        </span>
        <svg className="h-4 w-4 shrink-0 text-neutral-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose listing category"
          className="absolute left-0 right-0 z-50 mt-1 flex max-h-[min(26rem,72vh)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
        >
          <div className="border-b border-neutral-200 p-2 dark:border-slate-700">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter categories…"
              className="input-base w-full py-2 text-sm"
              aria-label="Filter categories"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-neutral-500 dark:text-slate-400">No categories match your search.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filtered.map((v) => {
                  const active = value === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                        active
                          ? "border-brand-primary/50 bg-brand-soft text-brand-primary shadow-sm ring-1 ring-brand-primary/20 dark:border-brand-accent/40 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-accent/25"
                          : "border-neutral-200/90 bg-white text-neutral-800 hover:border-brand-primary/30 hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                      }`}
                      onClick={() => {
                        onChange(v.id);
                        setOpen(false);
                        triggerRef.current?.focus();
                      }}
                    >
                      <span className="shrink-0 text-base leading-none" aria-hidden>
                        {categoryIcon(v.id)}
                      </span>
                      <span className="min-w-0 leading-tight">{v.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
