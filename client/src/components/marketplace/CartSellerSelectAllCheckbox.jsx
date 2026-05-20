import { useLayoutEffect, useRef } from "react";

export function CartSellerSelectAllCheckbox({ allChecked, someSelected, onChange, ariaLabel }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(someSelected && !allChecked);
  }, [someSelected, allChecked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 shrink-0 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/35 dark:border-slate-500"
      checked={allChecked}
      onChange={onChange}
      aria-label={ariaLabel}
    />
  );
}
