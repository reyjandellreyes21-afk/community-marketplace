import { Children, cloneElement, isValidElement } from "react";
import { cn } from "../../lib/cn.js";
import { Label } from "./Input.jsx";

function mergeDescribedBy(existing, parts) {
  const merged = [existing, ...parts].filter(Boolean).join(" ").trim();
  return merged || undefined;
}

/**
 * Mobile-friendly field stack: label, optional hint, one control, readable inline error.
 * Merges `aria-describedby` + `aria-invalid` onto a single child control when `id` is set.
 */
export function FormField({ id, label, hint, error, className, children, labelClassName }) {
  const hintId = id && hint ? `${id}-hint` : undefined;
  const errorId = id && error ? `${id}-error` : undefined;

  const childList = Children.toArray(children);
  const enhancedChildren = childList.map((child) => {
    if (!isValidElement(child) || !id) return child;
    const describedBy = mergeDescribedBy(child.props["aria-describedby"], [hintId, errorId]);
    return cloneElement(child, {
      id: child.props.id || id,
      "aria-invalid": error ? true : child.props["aria-invalid"],
      "aria-describedby": describedBy,
    });
  });

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && id ? (
        <Label htmlFor={id} className={labelClassName}>
          {label}
        </Label>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs leading-snug text-neutral-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
      {enhancedChildren}
      {error ? (
        <p id={errorId} role="alert" aria-live="polite" className="field-error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
