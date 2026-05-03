import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function listFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
    if (style && (style.visibility === "hidden" || style.display === "none")) return false;
    return el.getClientRects().length > 0;
  });
}

/**
 * Keeps keyboard focus inside `containerRef` while `active`, restores focus on teardown.
 * @param {boolean} active
 * @param {React.RefObject<HTMLElement | null>} containerRef
 * @param {{ initialFocusId?: string }} [options]
 */
export function useFocusTrap(active, containerRef, options = {}) {
  const { initialFocusId } = options;
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef.current) return undefined;

    const container = containerRef.current;
    previousFocusRef.current = document.activeElement;

    const focusPreferred = () => {
      if (initialFocusId && typeof document !== "undefined" && document.getElementById) {
        const preferred = document.getElementById(initialFocusId);
        if (preferred && container.contains(preferred) && listFocusable(container).includes(preferred)) {
          preferred.focus();
          return;
        }
      }
      const focusable = listFocusable(container);
      if (focusable.length > 0) focusable[0].focus();
    };

    const id = window.requestAnimationFrame(() => {
      focusPreferred();
    });

    const onKeyDown = (event) => {
      if (event.key !== "Tab") return;
      const focusable = listFocusable(container);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKeyDown, true);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === "function") {
        try {
          prev.focus();
        } catch {
          /* ignore */
        }
      }
    };
  }, [active, containerRef, initialFocusId]);
}
