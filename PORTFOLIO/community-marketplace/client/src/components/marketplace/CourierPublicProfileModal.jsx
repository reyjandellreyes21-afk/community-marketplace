import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { CourierPublicProfileContent } from "./CourierPublicProfileContent.jsx";

/**
 * Full-screen overlay profile (buyer/seller context: assign action in `footer`).
 * Portals to `document.body` so it is not clipped or mis-layered by order-card stacking contexts;
 * blurs the previously focused field (e.g. seller add-on input) to avoid a “lit” input behind the dimmer.
 *
 * @param {{
 *   open: boolean,
 *   courier: object | null,
 *   onClose: () => void,
 *   footer?: import("react").ReactNode,
 * }} props
 */
export function CourierPublicProfileModal({ open, courier, onClose, footer }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement;
    if (active && typeof active.blur === "function" && active instanceof HTMLElement) {
      active.blur();
    }
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [open]);

  if (!open || !courier) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[125] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm dark:bg-slate-950/70"
        aria-label="Close profile"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-neutral-200/90 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.14)] dark:border-slate-600 dark:bg-slate-900 sm:rounded-2xl sm:shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-slate-700">
          <p className="text-xs font-semibold text-neutral-500 dark:text-slate-400">Courier profile</p>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft/50 dark:text-brand-accent dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <CourierPublicProfileContent courier={courier} variant="sheet" titleId={titleId} />
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-neutral-100 px-4 py-3 dark:border-slate-700">{footer}</div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
