import { useId } from "react";

/**
 * OFF / ON availability — same visual grammar as {@link ../OrdersRoleToggle.jsx} (Activity orders hub).
 *
 * @param {{
 *   isOn: boolean,
 *   saving: boolean,
 *   availabilityLocked: boolean,
 *   canTurnOn: boolean,
 *   saveStatus: (next: string) => void | Promise<void>,
 *   hintText?: string,
 *   className?: string,
 *   desktopSidebar?: boolean,
 * }} props
 */
export function CourierHubAvailabilityRoleToggle({
  isOn,
  saving,
  availabilityLocked,
  canTurnOn = true,
  saveStatus,
  hintText = "",
  className = "",
  desktopSidebar = false,
}) {
  const hintId = useId();
  const segments = [
    {
      id: "paused",
      label: "OFF",
      selected: !isOn,
      onSelect: () => void saveStatus("offline"),
      disabled: saving || availabilityLocked,
      title: availabilityLocked
        ? "Finish your active delivery before pausing your listing."
        : "Pause listing — you won’t appear in Neighbor couriers or receive open tasks.",
    },
    {
      id: "deliveries",
      label: "ON",
      selected: isOn,
      onSelect: () => void saveStatus("available"),
      disabled: saving || availabilityLocked || !canTurnOn,
      title: availabilityLocked
        ? "Finish your active delivery before changing listing."
        : !canTurnOn
          ? "Complete your profile before listing yourself for deliveries."
          : "List for deliveries — neighbors can suggest you and you’ll see open tasks.",
    },
  ];

  const tabListClass = desktopSidebar
    ? `flex w-full min-w-0 flex-col gap-1 ${className}`
    : `flex w-full min-w-0 items-stretch gap-1.5 ${className}`;

  return (
    <>
      {hintText && !desktopSidebar ? (
        <p
          id={hintId}
          className="mb-2 px-1 text-center text-[11px] leading-snug text-neutral-600 dark:text-slate-400"
          aria-live="polite"
        >
          {hintText}
        </p>
      ) : null}
      <div
        role="tablist"
        aria-label="Courier availability"
        aria-describedby={hintText && !desktopSidebar ? hintId : undefined}
        aria-orientation={desktopSidebar ? "vertical" : undefined}
        className={tabListClass}
      >
        {segments.map((seg) => {
          if (desktopSidebar) {
            return (
              <button
                key={seg.id}
                type="button"
                role="tab"
                aria-selected={seg.selected}
                tabIndex={seg.selected ? 0 : -1}
                disabled={seg.disabled}
                title={seg.title}
                onClick={() => {
                  if (seg.selected) return;
                  seg.onSelect();
                }}
                className={`relative flex w-full min-w-0 flex-row items-center gap-2 rounded-r-lg border-l-[3px] py-2.5 pl-2.5 pr-2 text-left transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/45 dark:focus-visible:ring-offset-slate-950 ${
                  seg.selected
                    ? seg.id === "deliveries"
                      ? "border-primary bg-primary-soft/80 ring-1 ring-primary/15 dark:border-brand-accent dark:bg-slate-800/80 dark:ring-brand-accent/20"
                      : "border-primary bg-primary-soft/75 dark:border-brand-accent dark:bg-slate-800/65"
                    : "border-transparent hover:bg-primary-soft/40 dark:hover:bg-slate-800/45"
                } ${seg.disabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <span
                  className={`min-w-0 flex-1 text-xs font-semibold leading-tight ${
                    seg.selected ? "text-primary dark:text-brand-accent" : "text-neutral-600 dark:text-slate-400"
                  }`}
                >
                  {seg.label === "ON" ? "Courier on" : "Courier off"}
                </span>
              </button>
            );
          }

          return (
            <button
              key={seg.id}
              type="button"
              role="tab"
              aria-selected={seg.selected}
              tabIndex={seg.selected ? 0 : -1}
              disabled={seg.disabled}
              title={seg.title}
              onClick={() => {
                if (seg.selected) return;
                seg.onSelect();
              }}
              className={`relative flex min-h-[3rem] flex-1 min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-sm font-semibold leading-tight transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/45 dark:focus-visible:ring-offset-slate-900 min-[380px]:gap-2 min-[380px]:px-3 md:px-4 ${
                seg.selected
                  ? seg.id === "deliveries"
                    ? "border-2 border-primary bg-primary-soft text-primary shadow-sm dark:border-brand-accent dark:bg-slate-800 dark:text-brand-accent"
                    : "border-primary bg-primary text-white shadow-md shadow-primary/20 dark:border-brand-accent dark:bg-brand-accent dark:shadow-brand-accent/25"
                  : "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              } ${seg.disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span className="min-w-0 truncate">{seg.label}</span>
            </button>
          );
        })}
      </div>
      {hintText && desktopSidebar ? (
        <p className="mt-2 px-1 text-[10px] leading-snug text-neutral-500 dark:text-slate-500" aria-live="polite">
          {hintText}
        </p>
      ) : null}
    </>
  );
}

/** Matches {@link ../ActivityHubOrderStatusStrip.jsx} default variant tab layout. */
const commerceFlowStatusTabLayoutClass = "flex-1 basis-0 min-w-0 px-0.5 text-center";

/**
 * Tasks · Stats · Feedback — equal-width tabs across the full row.
 *
 * @param {{
 *   courierHubTasks: boolean,
 *   courierHubStats: boolean,
 *   courierHubFeedback: boolean,
 *   onTasks: () => void,
 *   onStats: () => void,
 *   onFeedback: () => void,
 * }} props
 */
export function CourierHubSectionUnderlineTabs({
  courierHubTasks,
  courierHubStats,
  courierHubFeedback,
  onTasks,
  onStats,
  onFeedback,
}) {
  const tabs = [
    { id: "tasks", label: "Tasks", selected: courierHubTasks, onClick: onTasks },
    { id: "stats", label: "Stats", selected: courierHubStats, onClick: onStats },
    { id: "feedback", label: "Feedback", selected: courierHubFeedback, onClick: onFeedback },
  ];

  return (
    <div className="relative mt-2 w-full min-w-0 border-b border-neutral-200/80 dark:border-slate-700/70">
      <div className="flex w-full min-w-0 flex-nowrap items-end gap-0 px-0" role="tablist" aria-label="Courier hub sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            tabIndex={t.selected ? 0 : -1}
            aria-selected={t.selected}
            aria-controls="courier-hub-panel"
            onClick={t.onClick}
            className={`relative min-h-[2.75rem] pb-2 pt-1 text-sm font-semibold leading-tight transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/45 dark:focus-visible:ring-offset-slate-900 ${commerceFlowStatusTabLayoutClass} ${
              t.selected
                ? "text-primary after:absolute after:inset-x-0 after:-bottom-px after:h-[2.5px] after:rounded-full after:bg-primary dark:text-brand-accent dark:after:bg-brand-accent"
                : "text-neutral-500 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span className="inline-flex max-w-full min-w-0 items-center justify-center gap-1 whitespace-nowrap">
              <span className="min-w-0 truncate">{t.label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
