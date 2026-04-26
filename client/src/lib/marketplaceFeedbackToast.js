/** Styling + a11y for marketplace toast banners (single source for stacked toasts). */
export const computeMarketplaceFeedbackForText = (raw) => {
  const text = String(raw ?? "").trim();
  const isError =
    /(^|[\s])(error|failed|could not|cannot|can't|invalid|required|already|expired|unable|denied|not found)\b/i.test(text);
  const isSuccess =
    !isError &&
    /(success|successfully|added|updated|deleted|accepted|applied|joined|saved|published|completed|order placed)/i.test(text);
  const tone = isError ? "error" : isSuccess ? "success" : "info";
  if (tone === "success") {
    return {
      text,
      tone,
      icon: "✓",
      role: "status",
      live: "polite",
      className:
        "border-emerald-200/90 bg-emerald-50/90 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
      dismissClass: "text-emerald-800 hover:text-emerald-900 dark:text-emerald-200 dark:hover:text-emerald-100",
    };
  }
  if (tone === "error") {
    return {
      text,
      tone,
      icon: "!",
      role: "alert",
      live: "assertive",
      className:
        "border-rose-200/90 bg-rose-50/90 text-rose-950 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200",
      dismissClass: "text-rose-800 hover:text-rose-900 dark:text-rose-200 dark:hover:text-rose-100",
    };
  }
  return {
    text,
    tone,
    icon: "i",
    role: "status",
    live: "polite",
    className: "border-sky-200/90 bg-sky-50/90 text-sky-950 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200",
    dismissClass: "text-sky-800 hover:text-sky-900 dark:text-sky-200 dark:hover:text-sky-100",
  };
};
