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
  const inputRef = useRef(null);
  const triggerId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => VERTICALS.find((v) => v.id === value), [value]);

  useEffect(() => {
    if (open) return;
    setQuery(selected?.label || "");
  }, [selected?.label, open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return VERTICALS;
    const ranked = VERTICALS.map((v) => {
      const label = String(v.label || "").toLowerCase();
      const id = String(v.id || "").toLowerCase();
      let score = 99;
      if (label === q || id === q) score = 0;
      else if (label.startsWith(q)) score = 1;
      else if (id.startsWith(q)) score = 2;
      else if (label.includes(q)) score = 3;
      else if (id.includes(q)) score = 4;
      return { v, score };
    })
      .filter((row) => row.score < 99)
      .sort((a, b) => a.score - b.score || a.v.label.localeCompare(b.v.label));
    return ranked.map((row) => row.v);
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
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.select(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        setQuery(selected?.label || "");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected?.label]);

  const triggerRing = invalid
    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30"
    : "border-neutral-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 dark:border-slate-600 dark:focus:border-brand-primary dark:focus:ring-brand-primary/25";

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={triggerId} className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-brand-primary dark:text-brand-accent">
        Categories *
      </label>
      <div className={`input-base flex w-full items-center gap-2 ${triggerRing}`}>
        <span className="shrink-0 text-base leading-none text-neutral-500 dark:text-slate-400" aria-hidden>
          {categoryIcon(selected?.id || "")}
        </span>
        <input
          ref={inputRef}
          id={triggerId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-invalid={invalid || undefined}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) setOpen(true);
            } else if (e.key === "Enter" && open && filtered.length > 0) {
              e.preventDefault();
              onChange(filtered[0].id);
              setQuery(filtered[0].label);
              setOpen(false);
            }
          }}
          placeholder="Type category (e.g. Home, Fashion, Electronics)"
          className="min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-brand-primary transition hover:bg-brand-soft/45 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label={open ? "Close categories" : "Open categories"}
          onClick={() => {
            setOpen((o) => !o);
            if (!open) inputRef.current?.focus();
          }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {open ? (
        <div
          id={panelId}
          role="listbox"
          aria-label="Choose listing category"
          className="absolute left-0 right-0 z-50 mt-1 flex max-h-[min(26rem,72vh)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-neutral-500 dark:text-slate-400">No categories match your search.</p>
            ) : (
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-4">
                {filtered.map((v) => {
                  const active = value === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`flex min-h-[2.75rem] w-full items-center gap-2 border-0 border-b px-2 py-2.5 text-left text-sm font-medium transition ${
                        active
                          ? "border-brand-primary/60 bg-transparent text-brand-primary dark:border-brand-accent/55 dark:text-slate-100"
                          : "border-brand-primary/20 bg-transparent text-brand-primary hover:border-brand-primary/40 hover:bg-brand-soft/30 dark:border-brand-accent/25 dark:text-slate-200 dark:hover:border-brand-accent/45 dark:hover:bg-slate-800/40"
                      }`}
                      onClick={() => {
                        onChange(v.id);
                        setQuery(v.label);
                        setOpen(false);
                        inputRef.current?.focus();
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
