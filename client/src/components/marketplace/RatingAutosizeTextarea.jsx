import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Review / report fields: height follows content; no inner scrollbar.
 */
export function RatingAutosizeTextarea({
  id,
  value,
  onChange,
  disabled,
  maxLength,
  placeholder,
  enterKeyHint = "done",
  compact,
}) {
  const ref = useRef(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, compact, syncHeight]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => syncHeight());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncHeight]);

  /* Default height ≈ three lines of placeholder (reference: rating comment “cell”); still grows with content. */
  const baseClass = compact
    ? "input-base !min-h-[4.5rem] w-full resize-none overflow-hidden px-2 py-2 text-[12px] leading-snug md:!min-h-[4.5rem] md:text-xs"
    : "input-base !min-h-[5.5rem] w-full resize-none overflow-hidden py-3 text-base leading-relaxed md:!min-h-[5.5rem] md:text-sm";

  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      maxLength={maxLength}
      placeholder={placeholder}
      enterKeyHint={enterKeyHint}
      rows={1}
      className={baseClass}
    />
  );
}
