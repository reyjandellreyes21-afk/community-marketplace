import { useId } from "react";
import { getActivityTabChrome } from "../../lib/activityTabTheme.js";
import { cn } from "../../lib/cn.js";
import { ACTIVITY_TABS } from "../../views.js";
import { MODE_LABEL, MODE_ORDER } from "../../lib/courierTransportModes.js";
import { Button } from "../ui/Button.jsx";
import { CourierOpenDeliveries } from "./CourierOpenDeliveries.jsx";
import { CourierPublicProfileContent } from "./CourierPublicProfileContent.jsx";
import { COURIER_OPTIONAL_TAG_OPTIONS } from "../../hooks/useCourierPresence.js";

const courierChrome = getActivityTabChrome(ACTIVITY_TABS.COURIER);

function presenceHint(status) {
  if (status === "offline") return "";
  if (status === "busy") return "On a run — finish it, then pause listing when you’re free.";
  if (status === "active") return "Listed — neighbors can suggest you; tasks below.";
  return "";
}

function PresenceLoadingSkeleton() {
  return (
    <div className="mt-4 h-8 animate-pulse rounded-lg bg-violet-200/40 dark:bg-violet-900/40" aria-hidden />
  );
}

/**
 * @typedef {ReturnType<import("../../hooks/useCourierPresence.js").useCourierPresence>} CourierPresenceApi
 */

/**
 * @param {{
 *   courierPresence: CourierPresenceApi,
 *   onOrdersRefresh?: () => void | Promise<void>,
 *   courierProfileReady?: boolean,
 *   courierProfileMissing?: string[],
 *   onCourierCompleteProfile?: () => void,
 *   hideAvailabilityRadios?: boolean,
 *   onCourierHubOpenTaskCount?: (count: number) => void,
 * }} props
 */
export function CourierPresenceControls({
  courierPresence,
  onOrdersRefresh,
  courierProfileReady = true,
  courierProfileMissing = [],
  onCourierCompleteProfile,
  hideAvailabilityRadios = false,
  onCourierHubOpenTaskCount,
}) {
  const {
    token,
    communityId,
    courierStatus,
    loading,
    saving,
    note,
    saveFeedback,
    suggestedPesosDraft,
    setSuggestedPesosDraft,
    savingSuggested,
    allowTaskNotifications,
    savingNotify,
    savingTags,
    neighborSettingsOpen,
    setNeighborSettingsOpen,
    claimMode,
    profileModes,
    modesLoaded,
    selectableModes,
    refresh,
    refreshPresenceQuiet,
    saveSuggestedRate,
    saveTaskNotifications,
    saveStatus,
    onActiveRunMeta,
    toggleProfileMode,
    selectNextClaimMode,
    toggleOptionalTag,
    normalizedOptionalTags,
    neighborPreviewCourier,
    courierTransportState,
    isOn,
    availabilityLocked,
  } = courierPresence;

  const groupId = useId();
  const hintId = `${groupId}-hint`;
  const feedbackId = `${groupId}-feedback`;

  if (!token) return null;

  const availabilityHintText = availabilityLocked
    ? "You’re on an active delivery — finish before pausing listing or changing modes. Busy is set automatically."
    : presenceHint(courierStatus);
  const showAvailabilityHint = Boolean(availabilityHintText);
  const showNextClaimInSettings = selectableModes.length > 1;

  return (
    <div className="space-y-4">
      {!courierProfileReady ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200/85 bg-amber-50/60 px-3 py-3 dark:border-amber-900/45 dark:bg-amber-950/25"
        >
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Finish your profile to run deliveries</p>
          <p className="mt-1 text-[11px] leading-snug text-amber-900/90 dark:text-amber-200/90">
            Please complete the following required fields:{" "}
            {courierProfileMissing.length ? courierProfileMissing.join(", ") : "contact and address details"}. Save your profile
            before enabling courier availability.
          </p>
          {typeof onCourierCompleteProfile === "function" ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="primary"
                size="compact"
                className={cn("min-h-9 text-[11px] font-semibold", courierChrome.recoveryPrimary)}
                onClick={() => onCourierCompleteProfile()}
              >
                Complete profile
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div>
        {!communityId ? (
          <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">
            Join a community on your profile to receive neighbor deliveries.
          </p>
        ) : null}
        {!loading && neighborPreviewCourier ? (
          <div className={cn("mt-3 shadow-sm dark:shadow-none", courierChrome.courierPanelSurface)}>
            {communityId && !hideAvailabilityRadios ? (
              <div className="border-b border-violet-200/60 pb-3 dark:border-violet-800/35">
                <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wide text-violet-800/80 dark:text-violet-200/85">
                  Your courier availability
                </p>
                <div className="flex flex-col items-center gap-2">
                  {showAvailabilityHint ? (
                    <p id={hintId} className="text-center text-[11px] text-neutral-600 dark:text-slate-400" aria-live="polite">
                      {availabilityHintText}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-center gap-2" role="radiogroup" aria-label="Pause or resume listing">
                    <Button
                      type="button"
                      variant="ghost"
                      role="radio"
                      aria-checked={!isOn}
                      size="compact"
                      className={cn(
                        "!min-h-10 shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50",
                        !isOn
                          ? "!border !border-slate-700 !bg-slate-800 !text-white shadow-sm hover:!bg-slate-900 dark:!border-slate-400 dark:!bg-slate-500 dark:hover:!bg-slate-400"
                          : "!border !border-slate-300 !bg-slate-100 !text-slate-700 hover:!bg-slate-200 dark:!border-slate-600 dark:!bg-slate-900 dark:!text-slate-200 dark:hover:!bg-slate-800",
                      )}
                      disabled={saving || availabilityLocked}
                      onClick={() => void saveStatus("offline")}
                      title={
                        availabilityLocked
                          ? "Finish your active delivery before pausing your listing."
                          : "Pause listing — you won’t appear in Neighbor couriers or receive open tasks."
                      }
                    >
                      <span className="text-left leading-tight">Pause listing</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      role="radio"
                      aria-checked={isOn}
                      size="compact"
                      className={cn(
                        "!min-h-10 shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45",
                        isOn
                          ? "!border !border-emerald-600 !bg-emerald-600 !text-white shadow-sm hover:!bg-emerald-700 dark:!border-emerald-400 dark:!bg-emerald-500 dark:hover:!bg-emerald-600"
                          : "!border !border-emerald-300 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100 dark:!border-emerald-800 dark:!bg-emerald-950/30 dark:!text-emerald-100 dark:hover:!bg-emerald-950/50",
                      )}
                      disabled={saving || availabilityLocked || !courierProfileReady}
                      onClick={() => void saveStatus("available")}
                      title={
                        availabilityLocked
                          ? "Finish your active delivery before changing listing."
                          : !courierProfileReady
                            ? "Complete your profile before listing yourself for deliveries."
                            : "List for deliveries — neighbors can suggest you and you’ll see open tasks."
                      }
                    >
                      <span className="text-left leading-tight">Take deliveries</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            {communityId && hideAvailabilityRadios && showAvailabilityHint ? (
              <p id={hintId} className="mb-2 text-center text-[11px] text-neutral-600 dark:text-slate-400" aria-live="polite">
                {availabilityHintText}
              </p>
            ) : null}
            <div className={communityId ? "pt-3" : undefined}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-violet-800/90 dark:text-violet-200/90">
                  How neighbors see you
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  className={cn("min-h-9 shrink-0 px-3 text-[10px] font-semibold", courierChrome.recoverySecondary)}
                  onClick={() => setNeighborSettingsOpen(true)}
                >
                  Edit
                </Button>
              </div>
              <div className="mt-3 border-t border-violet-200/60 pt-3 dark:border-violet-800/35">
                <CourierPublicProfileContent courier={neighborPreviewCourier} variant="inline" />
              </div>
            </div>
          </div>
        ) : null}
        {loading ? (
          <PresenceLoadingSkeleton />
        ) : (
          <>
            {!communityId && !hideAvailabilityRadios ? (
              <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Pause or resume listing">
                <Button
                  type="button"
                  variant="ghost"
                  role="radio"
                  aria-checked={!isOn}
                  size="compact"
                  className={cn(
                    "!min-h-10 shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold",
                    !isOn
                      ? "!border !border-slate-700 !bg-slate-800 !text-white shadow-sm"
                      : "!border !border-slate-300 !bg-slate-100 !text-slate-700 dark:!border-slate-600 dark:!bg-slate-900 dark:!text-slate-200",
                  )}
                  disabled={saving || availabilityLocked}
                  onClick={() => void saveStatus("offline")}
                >
                  Pause listing
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  role="radio"
                  aria-checked={isOn}
                  size="compact"
                  className={cn(
                    "!min-h-10 shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold",
                    isOn
                      ? "!border !border-emerald-600 !bg-emerald-600 !text-white shadow-sm"
                      : "!border !border-emerald-300 !bg-emerald-50 !text-emerald-800 dark:!border-emerald-800 dark:!bg-emerald-950/30 dark:!text-emerald-100",
                  )}
                  disabled={saving || availabilityLocked || !courierProfileReady}
                  onClick={() => void saveStatus("available")}
                >
                  Take deliveries
                </Button>
              </div>
            ) : null}
            {!communityId && hideAvailabilityRadios && showAvailabilityHint ? (
              <p id={hintId} className="mt-2 text-center text-[11px] text-neutral-600 dark:text-slate-400" aria-live="polite">
                {availabilityHintText}
              </p>
            ) : null}
            {communityId && !neighborPreviewCourier && !hideAvailabilityRadios ? (
              <div className="mt-4 flex flex-col items-center gap-2">
                {showAvailabilityHint ? (
                  <p id={hintId} className="text-center text-[11px] text-neutral-600 dark:text-slate-400" aria-live="polite">
                    {availabilityHintText}
                  </p>
                ) : null}
                <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Pause or resume listing">
                  <Button
                    type="button"
                    variant="ghost"
                    role="radio"
                    aria-checked={!isOn}
                    size="compact"
                    className={cn(
                      "!min-h-10 rounded-xl px-3 py-2 text-[11px] font-semibold",
                      !isOn
                        ? "!border !border-slate-700 !bg-slate-800 !text-white"
                        : "!border !border-slate-300 !bg-slate-100 !text-slate-700 dark:!border-slate-600 dark:!bg-slate-900 dark:!text-slate-200",
                    )}
                    disabled={saving || availabilityLocked}
                    onClick={() => void saveStatus("offline")}
                  >
                    Pause listing
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    role="radio"
                    aria-checked={isOn}
                    size="compact"
                    className={cn(
                      "!min-h-10 rounded-xl px-3 py-2 text-[11px] font-semibold",
                      isOn
                        ? "!border !border-emerald-600 !bg-emerald-600 !text-white"
                        : "!border !border-emerald-300 !bg-emerald-50 !text-emerald-800 dark:!border-emerald-800 dark:!bg-emerald-950/30 dark:!text-emerald-100",
                    )}
                    disabled={saving || availabilityLocked || !courierProfileReady}
                    onClick={() => void saveStatus("available")}
                  >
                    Take deliveries
                  </Button>
                </div>
              </div>
            ) : null}
            {!hideAvailabilityRadios && saveFeedback ? (
              <p id={feedbackId} className="mt-1 text-center text-[11px] font-medium text-violet-800 dark:text-violet-200" aria-live="polite">
                {saveFeedback}
              </p>
            ) : null}
          </>
        )}
      </div>

      <>
        {note ? <p className="mb-3 text-[11px] text-neutral-600 dark:text-slate-400">{note}</p> : null}
        {courierStatus !== "offline" ? (
          <CourierOpenDeliveries
            token={token}
            communityId={communityId}
            courierStatus={courierStatus}
            courierProfileReady={courierProfileReady}
            viewerSuggestedCompensationCents={courierPresence.suggestedCompensationCents}
            courierTransportState={courierTransportState}
            showInlineTransportPicker={false}
            onActiveRunMeta={onActiveRunMeta}
            onCourierHubOpenTaskCount={onCourierHubOpenTaskCount}
            onClaimed={async () => {
              await refresh();
              if (typeof onOrdersRefresh === "function") await onOrdersRefresh();
            }}
            onDeliveriesLoaded={refreshPresenceQuiet}
          />
        ) : null}
      </>

      {neighborSettingsOpen ? (
        <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] dark:bg-slate-950/60"
            aria-label="Close settings"
            onClick={() => setNeighborSettingsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${groupId}-neighbor-settings-title`}
            className="relative z-[1] flex max-h-[min(90dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-neutral-200/90 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900 sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-slate-700">
              <p id={`${groupId}-neighbor-settings-title`} className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                Neighbor profile settings
              </p>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100/70 dark:text-violet-300 dark:hover:bg-violet-950/55"
                onClick={() => setNeighborSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {modesLoaded ? (
                <div className="space-y-3 rounded-xl border border-violet-200/60 bg-violet-50/50 px-3 py-3 dark:border-violet-800/40 dark:bg-violet-950/30">
                  <div>
                    <p className="text-xs font-semibold text-neutral-900 dark:text-slate-100">Transport</p>
                    <p className="mt-1 text-[10px] leading-snug text-neutral-600 dark:text-slate-400">
                      Which ways you deliver for neighbors. Tap to turn each mode on or off.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Profile transport modes">
                      {MODE_ORDER.map((m) => {
                        const active = profileModes.length > 0 ? profileModes.includes(m) : true;
                        return (
                          <Button
                            key={m}
                            type="button"
                            variant={active ? "primary" : "secondary"}
                            size="compact"
                            className={cn(
                              "min-h-8 px-2.5 text-[10px]",
                              active ? courierChrome.recoveryPrimary : courierChrome.recoverySecondary,
                            )}
                            disabled={
                              availabilityLocked ||
                              saving ||
                              savingNotify ||
                              savingTags ||
                              savingSuggested
                            }
                            onClick={() => void toggleProfileMode(m)}
                          >
                            {MODE_LABEL[m] ?? m}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  {showNextClaimInSettings ? (
                    <div className="border-t border-violet-200/55 pt-3 dark:border-violet-800/35">
                      <p className="text-[10px] font-semibold text-neutral-800 dark:text-slate-200">
                        When you accept a task, record it as
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-600 dark:text-slate-400">
                        Only matters while you offer more than one transport mode above.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Next delivery transport mode">
                        {selectableModes.map((m) => (
                          <Button
                            key={m}
                            type="button"
                            variant={claimMode === m ? "primary" : "secondary"}
                            size="compact"
                            className={cn(
                              "min-h-8 px-2.5 text-[10px]",
                              claimMode === m ? courierChrome.recoveryPrimary : courierChrome.recoverySecondary,
                            )}
                            disabled={
                              availabilityLocked ||
                              saving ||
                              savingNotify ||
                              savingTags ||
                              savingSuggested
                            }
                            onClick={() => selectNextClaimMode(m)}
                          >
                            {MODE_LABEL[m] ?? m}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500 dark:text-slate-400" role="status">
                  Loading transport settings…
                </p>
              )}

              <div className="rounded-xl border border-neutral-200/80 bg-white/70 px-3 py-2.5 dark:border-slate-600/50 dark:bg-slate-900/35">
                <p className="text-xs font-semibold text-neutral-900 dark:text-slate-100">Profile flair</p>
                <p className="mt-1 text-[10px] leading-snug text-neutral-600 dark:text-slate-400">
                  Optional tags on your card (personality, not your vehicle type — that&apos;s Transport above).
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
                  {COURIER_OPTIONAL_TAG_OPTIONS.map(({ id: tagId, label }) => {
                    const checked = normalizedOptionalTags.includes(tagId);
                    const tagDisabled = saving || savingTags || availabilityLocked;
                    return (
                      <label
                        key={tagId}
                        className={`inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-800 dark:text-slate-200 ${
                          tagDisabled ? "cursor-not-allowed opacity-60" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-neutral-300 text-violet-600 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-900"
                          checked={checked}
                          disabled={tagDisabled}
                          onChange={() => void toggleOptionalTag(tagId)}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200/80 bg-white/60 px-3 py-2.5 dark:border-slate-600/50 dark:bg-slate-900/30">
                <p className="text-xs font-semibold text-neutral-900 dark:text-slate-100">Suggested pay (optional)</p>
                <p className="mt-1 text-[10px] leading-snug text-neutral-600 dark:text-slate-400">
                  Reference only for neighbors — not charged automatically and not a bid. Saves when you leave the field.
                </p>
                <label className="mt-2 flex flex-col text-[10px] text-neutral-700 dark:text-slate-300">
                  Amount (₱)
                  <input
                    type="text"
                    inputMode="decimal"
                    className="mt-0.5 min-h-9 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-950"
                    placeholder="e.g. 50"
                    value={suggestedPesosDraft}
                    onChange={(e) => setSuggestedPesosDraft(e.target.value)}
                    onBlur={() => void saveSuggestedRate()}
                    disabled={savingSuggested || courierStatus === "busy"}
                    autoComplete="off"
                  />
                </label>
                {savingSuggested ? (
                  <p className="mt-1.5 text-[10px] text-neutral-500 dark:text-slate-500" aria-live="polite">
                    Saving…
                  </p>
                ) : null}
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-neutral-200/80 bg-white/80 px-3 py-2.5 dark:border-slate-600/50 dark:bg-slate-900/40">
                <input
                  id={`${groupId}-modal-notify-tasks`}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-violet-600 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-900"
                  checked={allowTaskNotifications}
                  disabled={savingNotify}
                  onChange={(e) => void saveTaskNotifications(e.target.checked)}
                />
                <label htmlFor={`${groupId}-modal-notify-tasks`} className="cursor-pointer text-[11px] leading-snug text-neutral-800 dark:text-slate-200">
                  Task &amp; assignment notifications
                  <span className="mt-0.5 block text-[10px] font-normal text-neutral-500 dark:text-slate-500">
                    Native apps can hook this up to push later; your token is never shown here.
                  </span>
                </label>
              </div>
            </div>
            <div className="shrink-0 border-t border-neutral-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] dark:border-slate-700">
              <Button
                type="button"
                variant="primary"
                className={`w-full ${courierChrome.recoveryPrimary}`}
                onClick={() => setNeighborSettingsOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
