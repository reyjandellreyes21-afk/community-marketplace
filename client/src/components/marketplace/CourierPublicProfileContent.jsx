import {
  COURIER_OPTIONAL_TAG_LABEL,
  courierNeighborStatusSummary,
  formatCourierModesForDisplay,
  formatSuggestedCompensationPesos,
} from "../../lib/courierPublicProfile.js";
import { MODE_LABEL, MODE_ORDER } from "../../lib/courierTransportModes.js";
import { cn } from "../../lib/cn.js";
import { StableAvatar } from "../media/StableMediaImage.jsx";

function normalizedProfileModes(modes) {
  const keys = Array.isArray(modes)
    ? [...new Set(modes.map((x) => String(x || "").trim().toLowerCase()).filter((x) => MODE_ORDER.includes(x)))]
    : [];
  return MODE_ORDER.filter((m) => keys.includes(m));
}

/** Avatar dot (listing / run state) — placed top-right so it stays visible above the photo. */
function courierListingDotProps(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "busy") {
    return { label: "On a delivery", tw: "bg-amber-500" };
  }
  if (s === "available" || s === "active") {
    return { label: "Listed for neighbor deliveries", tw: "bg-emerald-500" };
  }
  return {
    label: "Listing paused — not shown to neighbors",
    tw: "bg-neutral-400 dark:bg-neutral-500",
  };
}

/** One line under the name in dense preview — listing + how neighbors read you. */
function neighborDenseStatusLine(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "busy") return "On a delivery — neighbors see you as busy";
  if (s === "available") return "Listed for neighbors · available for delivery suggestions";
  if (s === "active") return "Listed · active (neighbors can suggest you)";
  return "Listing paused — hidden from neighbor courier lists";
}

/** Average buyer star rating from `courier_delivery_reviews` (shown when at least one rating exists). */
function BuyerRatingSummary({ avg, count, className }) {
  if (typeof avg !== "number" || !Number.isFinite(avg) || !count || count < 1) return null;
  return (
    <p
      className={className}
      role="status"
      aria-label={`Average ${avg.toFixed(1)} out of 5 stars from ${count} buyer ${count === 1 ? "rating" : "ratings"}`}
    >
      <span className="text-amber-500 dark:text-amber-400" aria-hidden>
        ★
      </span>{" "}
      <span className="tabular-nums font-semibold">{avg.toFixed(1)}</span>
      <span className="font-normal text-neutral-500 dark:text-slate-400">
        {" "}
        ({count} {count === 1 ? "rating" : "ratings"})
      </span>
    </p>
  );
}

/**
 * Neighbor-facing courier card — same information buyers/sellers see when picking a courier.
 *
 * @param {{
 *   courier: {
 *     id?: string,
 *     displayName?: string,
 *     username?: string,
 *     avatarUrl?: string | null,
 *     courierStatus?: string,
 *     optionalTags?: string[],
 *     modes?: string[],
 *     completedDeliveries?: number,
 *     badges?: { id: string, label: string }[],
 *     suggestedCompensationCents?: number | null,
 *     runAssignmentMode?: string | null,
 *     nextClaimMode?: string | null,
 *     courierAvgRating?: number | null,
 *     courierReviewCount?: number,
 *   },
 *   variant?: "inline" | "sheet",
 *   titleId?: string,
 *   showListingStatusDot?: boolean,
 * }} props
 */
export function CourierPublicProfileContent({ courier, variant = "inline", titleId, showListingStatusDot = true }) {
  const c = courier && typeof courier === "object" ? courier : {};
  const displayName = String(c.displayName || c.username || "Member").trim() || "Member";
  const modesLine = formatCourierModesForDisplay(c.modes);
  const sug = formatSuggestedCompensationPesos(c.suggestedCompensationCents);
  const badges = Array.isArray(c.badges) ? c.badges : [];
  const optionalTags = Array.isArray(c.optionalTags) ? c.optionalTags : [];
  const completed =
    typeof c.completedDeliveries === "number" && c.completedDeliveries > 0 ? c.completedDeliveries : null;

  const runModeRaw = String(c.runAssignmentMode || "").trim().toLowerCase();
  const runAssignmentLabel =
    runModeRaw && MODE_ORDER.includes(runModeRaw) ? MODE_LABEL[runModeRaw] || runModeRaw : null;
  const nextModeRaw = String(c.nextClaimMode || "").trim().toLowerCase();
  const nextClaimLabel =
    nextModeRaw && MODE_ORDER.includes(nextModeRaw) ? MODE_LABEL[nextModeRaw] || nextModeRaw : null;

  const profileModeKeys = normalizedProfileModes(c.modes);
  /** Empty profile = unrestricted (any mode) — show all three in preview as “on” for first-time couriers. */
  const modeChipsActive = (m) => (profileModeKeys.length > 0 ? profileModeKeys.includes(m) : true);
  /** With explicit modes saved, only show those chips (e.g. Run-only → hide Walk/Bike). */
  const modesToPreview =
    profileModeKeys.length > 0 ? profileModeKeys : MODE_ORDER;
  const singleProfileMatchesNext =
    profileModeKeys.length === 1 && nextModeRaw && profileModeKeys[0] === nextModeRaw;
  const showNextClaimLine =
    Boolean(nextClaimLabel) &&
    !runAssignmentLabel &&
    !singleProfileMatchesNext &&
    (profileModeKeys.length > 1 || profileModeKeys.length === 0);

  const dense = variant === "inline";
  const avatarClass = dense ? "h-full w-full text-sm" : "h-16 w-16 text-base";
  const avatarWrapClass = dense ? "h-12 w-12" : "h-16 w-16";
  const titleClass = dense ? "text-sm font-semibold" : "text-lg font-semibold";
  const dot = showListingStatusDot ? courierListingDotProps(c.courierStatus) : null;

  const transportOfferSummary =
    profileModeKeys.length === 0
      ? "You haven’t limited modes — neighbors see Walk, Run, Bike, and Others as options. Limit modes in Edit if you only offer some ways to deliver."
      : `Neighbors see you for: ${profileModeKeys.map((m) => MODE_LABEL[m] ?? m).join(", ")}.`;

  const avatarRing = (
    <div
      className={cn(
        "relative shrink-0 rounded-full ring-2 ring-violet-100/80 dark:ring-violet-900/50",
        avatarWrapClass,
      )}
    >
      <StableAvatar
        src={c.avatarUrl || ""}
        alt=""
        initials={(displayName.trim().charAt(0) || "?").toUpperCase()}
        className={cn(avatarClass, "block h-full w-full min-h-0 min-w-0 rounded-full")}
        sizes={dense ? "48px" : "64px"}
      />
      {dot ? (
        <span
          className={cn(
            "pointer-events-none absolute top-1 right-1 z-[3] h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-950",
            dot.tw,
          )}
          role="img"
          aria-label={dot.label}
        />
      ) : null}
    </div>
  );

  return (
    <div className="space-y-3">
      {dense ? (
        <div className="w-full min-w-0 rounded-xl border border-neutral-200/90 bg-white/95 p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/75">
          <div className="flex items-start gap-3 border-b border-neutral-200/80 pb-3 dark:border-slate-700/80">
            {avatarRing}
            <div className="min-w-0 flex-1">
              <h3 id={titleId} className="min-w-0 truncate text-sm font-semibold text-violet-900 dark:text-violet-100">
                {displayName}
              </h3>
              {sug ? (
                <p
                  className="mt-1 inline-flex max-w-full flex-wrap items-baseline gap-x-1 rounded-lg bg-violet-100/95 px-2 py-1 text-[11px] font-semibold leading-snug text-violet-950 ring-1 ring-violet-200/90 dark:bg-violet-950/55 dark:text-violet-50 dark:ring-violet-700/50"
                  role="status"
                >
                  <span className="font-semibold">Suggested rate</span>{" "}
                  <span className="tabular-nums font-bold">{sug}</span>{" "}
                  <span className="text-[10px] font-medium text-violet-800/90 dark:text-violet-200/90">(reference)</span>
                </p>
              ) : null}
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-600 dark:text-slate-400">
                {neighborDenseStatusLine(c.courierStatus)}
              </p>
              <BuyerRatingSummary
                avg={c.courierAvgRating}
                count={c.courierReviewCount}
                className="mt-1 text-[10px] leading-snug text-neutral-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="mt-3 space-y-4">
            <div>
              <p className="text-xs font-semibold text-neutral-800 dark:text-slate-100">How you deliver</p>
              <p className="mt-0.5 text-[10px] leading-snug text-neutral-500 dark:text-slate-400">
                Read-only preview — change modes in Edit.
              </p>
              {runAssignmentLabel ? (
                <p className="mt-2 text-[11px] font-medium text-amber-900 dark:text-amber-100">
                  This run: <span className="font-semibold">{runAssignmentLabel}</span>
                </p>
              ) : null}
              <p className="mt-2 text-[10px] leading-snug text-neutral-600 dark:text-slate-400">{transportOfferSummary}</p>
              <div className="mt-2 flex w-full gap-1.5" role="group" aria-label="Transport modes on your public card">
                {modesToPreview.map((m) => {
                  const on = modeChipsActive(m);
                  return (
                    <span
                      key={m}
                      className={cn(
                        "flex min-h-8 min-w-0 flex-1 basis-0 items-center justify-center rounded-md px-1 py-1 text-center text-[10px] font-semibold leading-tight",
                        on
                          ? "bg-violet-600 text-white shadow-sm dark:bg-violet-500"
                          : "border border-neutral-200/90 bg-neutral-50 text-neutral-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-400",
                      )}
                    >
                      {MODE_LABEL[m] ?? m}
                    </span>
                  );
                })}
              </div>
            </div>
            {showNextClaimLine ? (
              <p className="border-t border-neutral-200/80 pt-3 text-[10px] leading-snug text-neutral-600 dark:border-slate-700/80 dark:text-slate-400">
                Your next accept is recorded as{" "}
                <span className="font-semibold text-neutral-900 dark:text-slate-100">{nextClaimLabel}</span> (separate from
                this preview).
              </p>
            ) : null}
            {badges.length > 0 ? (
              <div className="border-t border-neutral-200/80 pt-4 dark:border-slate-700/80">
                <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-500">Badges</p>
                <div className="mt-2 flex flex-wrap gap-1" aria-label="Earned courier badges">
                  {badges.map((b) => (
                    <span
                      key={b.id}
                      className="rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-semibold text-amber-950 ring-1 ring-amber-300/60 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-700/50"
                      title="Earned from completed deliveries"
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {optionalTags.length > 0 ? (
              <div className="border-t border-neutral-200/80 pt-4 dark:border-slate-700/80">
                <p className="text-xs font-semibold text-neutral-800 dark:text-slate-100">Optional flair</p>
                <p className="mt-0.5 text-[10px] leading-snug text-neutral-500 dark:text-slate-400">
                  Short labels neighbors notice on your card.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Optional neighbor badges">
                  {optionalTags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full border border-violet-200/90 bg-violet-50/90 px-2.5 py-1 text-[10px] font-medium text-violet-900 dark:border-violet-700/50 dark:bg-violet-950/40 dark:text-violet-100"
                    >
                      {COURIER_OPTIONAL_TAG_LABEL[t] || t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {completed != null ? (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-neutral-200/80 pt-3 text-[11px] text-neutral-500 dark:border-slate-700/80 dark:text-slate-400">
              <span>
                <span className="font-medium text-neutral-700 dark:text-slate-300">{completed}</span> completed
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start gap-3">
          {avatarRing}
          <div className="min-w-0 flex-1 space-y-2">
            <h3 id={titleId} className={`min-w-0 truncate text-neutral-900 dark:text-slate-100 ${titleClass}`}>
              {displayName}
            </h3>
            <p className="text-[11px] leading-snug text-neutral-600 dark:text-slate-400">
              {courierNeighborStatusSummary(c.courierStatus)}
            </p>
            <BuyerRatingSummary
              avg={c.courierAvgRating}
              count={c.courierReviewCount}
              className="text-[11px] leading-snug text-neutral-800 dark:text-slate-200"
            />

            {runAssignmentLabel ? (
              <p className="text-[11px] font-medium text-violet-900 dark:text-violet-200">
                This run: <span className="tabular-nums">{runAssignmentLabel}</span>
              </p>
            ) : nextClaimLabel ? (
              <div className="space-y-0.5">
                <p className="text-[11px] text-neutral-600 dark:text-slate-400">
                  Transport for your next run:{" "}
                  <span className="font-semibold text-neutral-800 dark:text-slate-200">{nextClaimLabel}</span>
                </p>
                <p className="text-[10px] leading-snug text-neutral-500 dark:text-slate-500">
                  This is what we record when you accept an open task or a delivery invitation.
                </p>
              </div>
            ) : null}
            {(modesLine || completed != null) && (
              <p className="text-[11px] text-neutral-500 dark:text-slate-500">
                {completed != null ? `${completed} completed` : ""}
                {completed != null && modesLine ? " · " : ""}
                {modesLine || ""}
              </p>
            )}

            {sug ? (
              <p className="text-[11px] font-medium text-neutral-700 dark:text-slate-300">
                Suggested neighbor rate: <span className="tabular-nums">{sug}</span>{" "}
                <span className="font-normal text-neutral-500 dark:text-slate-500">(reference only)</span>
              </p>
            ) : null}
          </div>
        </div>
      )}

      {!dense && badges.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-500">Badges</p>
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <span
                key={b.id}
                className="rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-semibold text-amber-950 ring-1 ring-amber-300/60 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-700/50"
                title="Earned from completed deliveries"
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {optionalTags.length > 0 && !dense ? (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-500">
            Optional tags
          </p>
          <div className="flex flex-wrap gap-1">
            {optionalTags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-emerald-100/90 px-2 py-0.5 text-[10px] font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
              >
                {COURIER_OPTIONAL_TAG_LABEL[t] || t}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
