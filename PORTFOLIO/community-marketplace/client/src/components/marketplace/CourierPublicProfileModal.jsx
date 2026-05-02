import { useEffect, useId } from "react";
import { CourierPublicProfileContent } from "./CourierPublicProfileContent.jsx";

/**
 * Full-screen overlay profile (buyer/seller context: assign action in `footer`).
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

  if (!open || !courier) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] dark:bg-slate-950/60"
        aria-label="Close profile"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-neutral-200/90 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.12)] dark:border-slate-600 dark:bg-slate-900 sm:rounded-2xl sm:shadow-xl"
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
}
