import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button.jsx";

/**
 * Simple confirm modal to guard against losing local draft changes.
 *
 * @param {{
 *  open: boolean,
 *  title?: string,
 *  message?: string,
 *  confirmLabel?: string,
 *  cancelLabel?: string,
 *  busy?: boolean,
 *  onConfirm: () => void,
 *  onClose: () => void,
 * }} props
 */
export function DiscardUnsavedChangesModal({
  open,
  title = "Discard changes?",
  message = "You have unsaved changes. If you leave now, your edits will be lost.",
  confirmLabel = "Discard",
  cancelLabel = "Stay",
  busy,
  onConfirm,
  onClose,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement;
    if (active && typeof active.blur === "function" && active instanceof HTMLElement) active.blur();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm dark:bg-slate-950/70"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
      >
        <div className="border-b border-neutral-100 px-4 py-3 dark:border-slate-700">
          <p id={titleId} className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
            {title}
          </p>
          <p className="mt-1 text-xs leading-snug text-neutral-600 dark:text-slate-400">{message}</p>
        </div>
        <div className="flex gap-2 px-4 py-3">
          <Button type="button" variant="secondary" className="min-h-11 flex-1" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" className="min-h-11 flex-1" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}

