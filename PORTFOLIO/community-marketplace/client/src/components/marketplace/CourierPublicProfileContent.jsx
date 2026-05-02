import {
  COURIER_OPTIONAL_TAG_LABEL,
  courierNeighborStatusSummary,
  formatCourierModesForDisplay,
  formatSuggestedCompensationPesos,
} from "../../lib/courierPublicProfile.js";
import { StableAvatar } from "../media/StableMediaImage.jsx";

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
 *   },
 *   variant?: "inline" | "sheet",
 *   titleId?: string,
 * }} props
 */
export function CourierPublicProfileContent({ courier, variant = "inline", titleId }) {
  const c = courier && typeof courier === "object" ? courier : {};
  const displayName = String(c.displayName || c.username || "Member").trim() || "Member";
  const modesLine = formatCourierModesForDisplay(c.modes);
  const sug = formatSuggestedCompensationPesos(c.suggestedCompensationCents);
  const badges = Array.isArray(c.badges) ? c.badges : [];
  const optionalTags = Array.isArray(c.optionalTags) ? c.optionalTags : [];
  const completed =
    typeof c.completedDeliveries === "number" && c.completedDeliveries > 0 ? c.completedDeliveries : null;

  const dense = variant === "inline";
  const avatarClass = dense ? "h-12 w-12 text-sm" : "h-16 w-16 text-base";
  const titleClass = dense ? "text-sm font-semibold" : "text-lg font-semibold";

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <StableAvatar
          src={c.avatarUrl || ""}
          alt=""
          initials={(displayName.trim().charAt(0) || "?").toUpperCase()}
          className={`${avatarClass} shrink-0 rounded-full`}
          sizes={dense ? "48px" : "64px"}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id={titleId} className={`min-w-0 truncate text-neutral-900 dark:text-slate-100 ${titleClass}`}>
            {displayName}
          </h3>
          <p className="text-[11px] text-neutral-600 dark:text-slate-400">{courierNeighborStatusSummary(c.courierStatus)}</p>
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

      {badges.length > 0 ? (
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

      {optionalTags.length > 0 ? (
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
