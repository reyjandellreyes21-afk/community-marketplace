import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { getActivityTabChrome } from "../../lib/activityTabTheme.js";
import { cn } from "../../lib/cn.js";
import { formatShortRelativeTime } from "../../lib/relativeTime.js";
import { ACTIVITY_TABS } from "../../views.js";
import { ProductListingMedia } from "../media/ProductListingMedia.jsx";
import { Button } from "../ui/Button.jsx";
import { buyerCommentDisplayForOrderCard } from "../../lib/listingSaleMeta.js";
import { orderCodGrandTotalCents, orderLineUnitPriceCents } from "../../lib/orderLineCents.js";
import { formatCents } from "../../marketplace/money.js";
import { enrichListingSnapshotForOrderCard } from "../../lib/listingImageUrl.js";
import { defaultClaimModeFromProfile, MODE_LABEL, MODE_ORDER } from "../../lib/courierTransportModes.js";

const courierChrome = getActivityTabChrome(ACTIVITY_TABS.COURIER);

const RUN_STATUS_NOTE = {
  courier_assigned: "Assigned to you — coordinate pickup with the seller.",
  out_for_delivery: "Out for delivery — settle COD at handoff.",
};

/** Matches Activity → Orders list view / Home → Community list row thumbnails (`App.jsx`). */
const OPEN_TASK_THUMB = "aspect-square w-[7.5rem] shrink-0";

/** @param {ReturnType<typeof enrichListingSnapshotForOrderCard>} enriched */
function listingThumbFromEnriched(enriched) {
  return {
    id: enriched.id,
    title: enriched.title || "Product",
    imageUrl: enriched.imageUrl || "",
    imageUrls: Array.isArray(enriched.imageUrls) ? enriched.imageUrls : [],
  };
}

function isLikelyOfflineError(e) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String(e?.message || e || "");
  return /failed to fetch|network|load failed|offline/i.test(msg);
}

function activeRunStatusNote(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  return RUN_STATUS_NOTE[s] || null;
}

/** Helper copy under Accept on suggested-invitation tasks (buyer/seller picked this courier). */
function CourierInvitationNote({ invitedByBuyer, invitedBySeller }) {
  const b = Boolean(invitedByBuyer);
  const s = Boolean(invitedBySeller);
  let lead =
    "A buyer or seller picked you for this delivery.";
  if (b && s) lead = "The buyer and seller both picked you for this delivery.";
  else if (b) lead = "The buyer picked you for this delivery.";
  else if (s) lead = "The seller picked you for this delivery.";
  const detail = "Accept delivery to assign the run to yourself.";
  return (
    <p className="text-pretty text-[11px] leading-relaxed sm:text-xs">
      <span className="font-semibold text-violet-950 dark:text-violet-100">{lead}</span>{" "}
      <span className="text-neutral-600 dark:text-slate-400">{detail}</span>
    </p>
  );
}

/**
 * Shared product row for open tasks and “current delivery”.
 *
 * @param {{ o: object, listing: object | null, courierChrome: { recoveryPrimary: string }, showAcceptButton: boolean, canClaimDeliveries: boolean, claimingId: string | null, onAccept?: () => void, topMeta?: import("react").ReactNode, bottomMeta?: import("react").ReactNode }} props
 */
function OpenDeliveryTaskRow({
  o,
  listing,
  courierChrome,
  showAcceptButton,
  canClaimDeliveries,
  claimingId,
  onAccept,
  topMeta,
  bottomMeta,
}) {
  const enriched = enrichListingSnapshotForOrderCard(o, listing);
  const thumbListing = listingThumbFromEnriched(enriched);
  const processingRaw = o.processingEnteredAt ?? o.processing_entered_at;
  const processingRel = formatShortRelativeTime(processingRaw);
  const postedFallback = !processingRel ? formatShortRelativeTime(o.createdAt) : "";
  const qty = Math.max(1, Math.floor(Number(o.quantity) || 1));
  const unitCents = orderLineUnitPriceCents(o);
  const goodsCents = Math.max(0, Number(o.codGoodsCents) || 0);
  const deliveryCents = Math.max(0, Number(o.codDeliveryCents) || 0);
  const buyerPool = Math.max(
    0,
    Number(o.buyerCourierContributionCents ?? o.buyer_courier_contribution_cents) || 0,
  );
  const sellerPool = Math.max(
    0,
    Number(o.sellerCourierContributionCents ?? o.seller_courier_contribution_cents) || 0,
  );
  const totalCents = orderCodGrandTotalCents(o);
  const variantRow = buyerCommentDisplayForOrderCard(o.comment, String(o.variantSignature || "").trim());

  return (
    <li className="relative lm-card lm-list-card lm-product-card-list flex flex-col gap-3 border border-neutral-200/80 bg-white p-3 shadow-sm dark:border-slate-600/70 dark:bg-slate-900/40">
      <div className="flex w-full min-w-0 items-start gap-3">
        <div className={`lm-product-media lm-product-media--soft relative ${OPEN_TASK_THUMB} shrink-0 overflow-hidden rounded-md`}>
          <ProductListingMedia
            listing={thumbListing}
            variant="list"
            className="absolute inset-0 min-h-0"
            softChrome
            sizes="(max-width: 768px) 22vw, min(112px, 10vw)"
            loading="lazy"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="min-w-0 space-y-1">
            {topMeta ? (
              <div className="space-y-1 text-[11px] leading-snug text-neutral-600 dark:text-slate-400">{topMeta}</div>
            ) : null}
            <p className="truncate text-sm font-semibold leading-snug text-neutral-900 dark:text-slate-100">
              {enriched.title || "Product"}
            </p>
            <div className="space-y-0.5 text-[11px] leading-snug text-neutral-600 dark:text-slate-400">
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                <span>
                  <span className="font-medium text-neutral-700 dark:text-slate-300">Qty</span> {qty}
                </span>
                <span>
                  <span className="font-medium text-neutral-700 dark:text-slate-300">Price</span>{" "}
                  {formatCents(unitCents)} <span className="text-neutral-500 dark:text-slate-500">ea</span>
                </span>
              </div>
              {variantRow.show ? (
                <p className="text-pretty">
                  <span className="font-medium text-neutral-700 dark:text-slate-300">Variant</span> {variantRow.text}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 border-t border-neutral-200/70 pt-1 dark:border-slate-600/60">
                <>
                  <span
                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold leading-snug text-emerald-900 ring-1 ring-inset ring-emerald-200/90 dark:bg-emerald-950/45 dark:text-emerald-100 dark:ring-emerald-800/45"
                    title="Product total (goods)"
                  >
                    <span>Goods</span>
                    <span className="tabular-nums">{formatCents(goodsCents)}</span>
                  </span>
                  <span
                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-brand-soft/90 px-2 py-0.5 text-[11px] font-semibold leading-snug text-brand-primary ring-1 ring-inset ring-brand-primary/25 dark:bg-slate-800/90 dark:text-brand-accent dark:ring-brand-accent/30"
                    title="Your delivery tip (cash at handoff)"
                  >
                    <span>Delivery tip</span>
                    <span className="tabular-nums">{formatCents(deliveryCents)}</span>
                  </span>
                  <span className="w-full text-[10px] text-neutral-500 dark:text-slate-500">
                    Buyer {formatCents(buyerPool)} · Seller {formatCents(sellerPool)} — cash at handoff, not in-app
                  </span>
                </>
                <span
                  className="inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold leading-snug text-amber-950 ring-1 ring-inset ring-amber-200/90 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-800/40"
                  title="Collect at handoff (cash on delivery)"
                >
                  <span>Total</span>
                  <span className="tabular-nums">{formatCents(totalCents)}</span>
                  <span className="font-medium text-amber-800/85 dark:text-amber-200/90">COD</span>
                </span>
              </div>
            </div>
            {processingRel ? (
              <p className="text-[10px] text-neutral-500 dark:text-slate-500">In processing · {processingRel}</p>
            ) : postedFallback ? (
              <p className="text-[10px] text-neutral-500 dark:text-slate-500">Posted {postedFallback}</p>
            ) : null}
          </div>
          {showAcceptButton ? (
            <div className="flex w-full flex-row flex-wrap items-stretch justify-end gap-2">
              <Button
                type="button"
                variant="primary"
                className={cn(
                  "min-h-10 min-w-0 flex-1 px-3 text-xs sm:max-w-[14rem] sm:flex-none sm:min-w-[9rem]",
                  courierChrome.recoveryPrimary,
                )}
                loading={claimingId === o.id}
                loadingLabel="…"
                disabled={Boolean(claimingId) || !canClaimDeliveries}
                onClick={onAccept}
              >
                Accept delivery
              </Button>
            </div>
          ) : null}
          {bottomMeta ? (
            <div className="w-full border-t border-neutral-200/70 pt-2.5 dark:border-slate-600/55">{bottomMeta}</div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function OpenDeliveriesSkeleton() {
  return (
    <ul className="mt-2 space-y-2" aria-hidden>
      {[0, 1].map((i) => (
        <li
          key={i}
          className="relative lm-card lm-list-card lm-product-card-list flex animate-pulse flex-col gap-3 border border-neutral-200/70 bg-white p-3 dark:border-slate-600/70 dark:bg-slate-900/50"
        >
          <div className="flex w-full min-w-0 items-start gap-3">
            <div className={`lm-product-media lm-product-media--soft relative ${OPEN_TASK_THUMB} shrink-0 overflow-hidden rounded-md bg-neutral-200/80 dark:bg-slate-700/50`} />
            <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
              <div className="h-4 w-4/5 max-w-[12rem] rounded bg-neutral-200/90 dark:bg-slate-700/60" />
              <div className="h-3 w-2/3 max-w-[10rem] rounded bg-neutral-100/95 dark:bg-slate-800/60" />
              <div className="h-3 w-1/2 max-w-[8rem] rounded bg-neutral-100/90 dark:bg-slate-800/50" />
              <div className="h-3 w-3/4 max-w-[11rem] rounded bg-neutral-100/90 dark:bg-slate-800/50" />
              <div className="h-10 max-w-full rounded-lg bg-neutral-200/70 dark:bg-slate-700/45 sm:max-w-[10rem]" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Lists delivery orders open in the member's community (GET /delivery/open) plus
 * in-progress run from GET /delivery/active when the courier has claimed a task.
 * List rows match Home → Community product list layout on mobile.
 *
 * @param {{
 *   token: string,
 *   communityId: string,
 *   courierStatus: string,
 *   courierProfileReady?: boolean,
 *   onClaimed?: () => void | Promise<void>,
 *   onDeliveriesLoaded?: () => void | Promise<void>,
 *   viewerSuggestedCompensationCents?: number | null,
 *   courierTransportState?: { claimMode: string, setClaimMode: (v: string | ((p: string) => string)) => void, profileModes: string[], modesLoaded: boolean } | null,
 *   showInlineTransportPicker?: boolean,
 *   headerTrailing?: import("react").ReactNode,
 *   onActiveRunMeta?: (meta: { assignmentMode: string | null }) => void,
 *   onCourierHubOpenTaskCount?: (count: number) => void,
 * }} props
 */
export function CourierOpenDeliveries({
  token,
  communityId,
  courierStatus,
  courierProfileReady = true,
  onClaimed,
  onDeliveriesLoaded,
  viewerSuggestedCompensationCents = null,
  courierTransportState = null,
  showInlineTransportPicker = true,
  headerTrailing = null,
  onActiveRunMeta,
  onCourierHubOpenTaskCount,
}) {
  const [orders, setOrders] = useState([]);
  /** Buyer/seller invited this courier; order still `seller_accepted` until the courier accepts. */
  const [invitations, setInvitations] = useState(
    /** @type {{ assignmentId: string, order: object, assignmentMode: string | null, invitedByBuyer?: boolean, invitedBySeller?: boolean }[]} */ ([]),
  );
  /** In-progress run (`courier_assigned` / `out_for_delivery`) from GET /delivery/active — not included in open tasks. */
  const [activeOrder, setActiveOrder] = useState(/** @type {object | null} */ (null));
  const [assignmentMode, setAssignmentMode] = useState(/** @type {string | null} */ (null));
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState(null);
  const [error, setError] = useState("");
  const [claimBanner, setClaimBanner] = useState("");
  /** Same pattern as Activity orders: batch `/listings/:id` so thumbnails match Processing cards when the order snapshot is thin. */
  const [openListingsById, setOpenListingsById] = useState(/** @type {Record<string, object | null>} */ ({}));
  /** Transport mode for the next claim (`courier_assignments.mode`). */
  const [internalClaimMode, setInternalClaimMode] = useState("walk");
  const [internalProfileModes, setInternalProfileModes] = useState(/** @type {string[]} */ ([]));
  const [internalModesLoaded, setInternalModesLoaded] = useState(false);
  const claimMode = courierTransportState ? courierTransportState.claimMode : internalClaimMode;
  const setClaimMode = courierTransportState ? courierTransportState.setClaimMode : setInternalClaimMode;
  const profileModes = courierTransportState ? courierTransportState.profileModes : internalProfileModes;
  const modesLoaded = courierTransportState ? courierTransportState.modesLoaded : internalModesLoaded;
  /** Off = hidden; available/active/busy = hub is “on”. Claims blocked only when GET `/delivery/active` returns an order (DB-backed run). */
  const hubActive = courierStatus !== "offline";
  const canClaimDeliveries = hubActive && !activeOrder && courierProfileReady;

  const selectableModes = useMemo(() => {
    if (profileModes.length > 0) return MODE_ORDER.filter((x) => profileModes.includes(x));
    return [...MODE_ORDER];
  }, [profileModes]);

  const load = useCallback(async () => {
    if (!token || !communityId || !hubActive) {
      setOrders([]);
      setInvitations([]);
      setActiveOrder(null);
      setAssignmentMode(null);
      if (typeof onCourierHubOpenTaskCount === "function") onCourierHubOpenTaskCount(0);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [invResult, openResult, activeResult] = await Promise.allSettled([
        apiRequest("/delivery/invitations", { token }),
        apiRequest("/delivery/open", { token }),
        apiRequest("/delivery/active", { token }),
      ]);
      if (activeResult.status === "fulfilled") {
        const ad = activeResult.value;
        const ord = ad?.order ?? null;
        setActiveOrder(ord && typeof ord === "object" ? ord : null);
        const m = ad?.assignmentMode != null ? String(ad.assignmentMode).toLowerCase().trim() : "";
        setAssignmentMode(m && MODE_ORDER.includes(m) ? m : null);
      } else {
        setActiveOrder(null);
        setAssignmentMode(null);
      }
      if (invResult.status === "fulfilled") {
        const inv = invResult.value;
        setInvitations(Array.isArray(inv?.invitations) ? inv.invitations : []);
      } else {
        setInvitations([]);
      }
      if (openResult.status === "fulfilled") {
        const d = openResult.value;
        setOrders(Array.isArray(d?.orders) ? d.orders : []);
      } else {
        setOrders([]);
        const e = openResult.reason;
        if (isLikelyOfflineError(e)) {
          setError("You appear to be offline. Check your connection and try again.");
        } else {
          setError(e?.message || "Could not load open deliveries.");
        }
      }
      const openForCount =
        openResult.status === "fulfilled" && Array.isArray(openResult.value?.orders) ? openResult.value.orders : [];
      const invForCount =
        invResult.status === "fulfilled" && Array.isArray(invResult.value?.invitations)
          ? invResult.value.invitations
          : [];
      if (typeof onCourierHubOpenTaskCount === "function") {
        const seen = new Set();
        for (const o of openForCount) {
          const id = String(o?.id ?? "").trim();
          if (id) seen.add(id);
        }
        for (const i of invForCount) {
          const id = String(i?.order?.id ?? "").trim();
          if (id) seen.add(id);
        }
        onCourierHubOpenTaskCount(seen.size);
      }
      if (typeof onDeliveriesLoaded === "function") await onDeliveriesLoaded();
    } catch (e) {
      setOrders([]);
      setInvitations([]);
      setActiveOrder(null);
      setAssignmentMode(null);
      if (typeof onCourierHubOpenTaskCount === "function") onCourierHubOpenTaskCount(0);
      if (isLikelyOfflineError(e)) {
        setError("You appear to be offline. Check your connection and try again.");
      } else {
        setError(e?.message || "Could not load open deliveries.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, communityId, hubActive, onDeliveriesLoaded, onCourierHubOpenTaskCount]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (courierTransportState) return undefined;
    if (!token || !hubActive) {
      setInternalProfileModes([]);
      setInternalModesLoaded(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await apiRequest("/me/courier-modes", { token });
        const raw = Array.isArray(d?.modes) ? d.modes.map((x) => String(x || "").toLowerCase()).filter((x) => MODE_ORDER.includes(x)) : [];
        if (!cancelled) {
          setInternalProfileModes([...new Set(raw)]);
          setInternalClaimMode(defaultClaimModeFromProfile(raw));
          setInternalModesLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setInternalProfileModes([]);
          setInternalClaimMode("walk");
          setInternalModesLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, hubActive, courierTransportState]);

  useEffect(() => {
    if (!hubActive || !token) return undefined;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void load();
    };
    const id = window.setInterval(tick, 45000);
    return () => window.clearInterval(id);
  }, [hubActive, token, load]);

  useEffect(() => {
    setOpenListingsById({});
  }, [communityId]);

  useEffect(() => {
    if (!selectableModes.includes(claimMode)) {
      setClaimMode(selectableModes[0] || "walk");
    }
  }, [selectableModes, claimMode, setClaimMode]);

  useEffect(() => {
    if (typeof onActiveRunMeta !== "function") return undefined;
    onActiveRunMeta({ assignmentMode });
    return undefined;
  }, [onActiveRunMeta, assignmentMode]);

  useEffect(() => {
    if (!token || !hubActive) return undefined;
    const idFromOrders = orders.map((o) => String(o.listingId || ""));
    const idFromInv = invitations.map((i) => String(i.order?.listingId || ""));
    const idFromActive = activeOrder ? [String(activeOrder.listingId || "")] : [];
    const combined = [...idFromOrders, ...idFromInv, ...idFromActive];
    if (combined.every((id) => !id)) return undefined;
    const missingIds = Array.from(
      new Set(combined.filter((id) => id && openListingsById[id] === undefined)),
    );
    if (missingIds.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const data = await apiRequest(`/listings/${encodeURIComponent(id)}`, { token });
            return [id, data?.listing ?? null];
          } catch {
            return [id, null];
          }
        }),
      );
      if (cancelled) return;
      setOpenListingsById((prev) => {
        const next = { ...prev };
        for (const [id, listing] of entries) next[id] = listing;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token, hubActive, orders, invitations, activeOrder, openListingsById]);

  const invitationOrderIdSet = useMemo(
    () => new Set(invitations.map((i) => String(i.order?.id || "")).filter(Boolean)),
    [invitations],
  );

  const openTasksOrders = useMemo(
    () => orders.filter((o) => !invitationOrderIdSet.has(String(o.id || ""))),
    [orders, invitationOrderIdSet],
  );

  /** Next claim / invitation only — does not overwrite profile `courier_modes` (set under Activity → Courier → Edit). */
  const pickTransportMode = useCallback(
    (m) => {
      const next = MODE_ORDER.includes(String(m || "").trim().toLowerCase()) ? String(m).trim().toLowerCase() : "walk";
      setClaimMode(next);
    },
    [setClaimMode],
  );

  const claim = async (orderId) => {
    if (!token || !orderId) return;
    setClaimingId(orderId);
    setClaimBanner("");
    try {
      await apiRequest(`/orders/${encodeURIComponent(orderId)}/courier/claim`, {
        method: "POST",
        token,
        body: { mode: claimMode },
      });
      await load();
      if (typeof onClaimed === "function") await onClaimed();
      setClaimBanner(
        "Run accepted — coordinate pickup with the seller and settle COD for goods + delivery tip at handoff (cash only).",
      );
      window.setTimeout(() => setClaimBanner(""), 8000);
    } catch (e) {
      setError(e?.message || "Could not claim delivery.");
    } finally {
      setClaimingId(null);
    }
  };

  const respondInvitation = async (orderId) => {
    if (!token || !orderId) return;
    setClaimingId(orderId);
    setClaimBanner("");
    try {
      await apiRequest(`/orders/${encodeURIComponent(orderId)}/courier/invitation/respond`, {
        method: "POST",
        token,
        body: { accept: true, mode: claimMode },
      });
      await load();
      if (typeof onClaimed === "function") await onClaimed();
      setClaimBanner(
        "Run accepted — coordinate pickup with the seller and settle COD for goods + delivery tip at handoff (cash only).",
      );
      window.setTimeout(() => setClaimBanner(""), 8000);
    } catch (e) {
      setError(e?.message || "Could not accept invitation.");
    } finally {
      setClaimingId(null);
    }
  };

  if (!token || !communityId) return null;
  if (!hubActive) {
    return (
      <div className="space-y-2 border-t border-neutral-200/80 pt-4 mt-4 dark:border-slate-700/70">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
          <h4 className="text-xs font-semibold text-violet-950 dark:text-violet-100">Open tasks</h4>
          {headerTrailing}
        </div>
        <p className="text-[11px] text-neutral-600 dark:text-slate-400">
          Choose <span className="font-semibold text-violet-900 dark:text-violet-200">ON</span> above to see tasks you can accept.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-neutral-200/80 pt-4 mt-4 dark:border-slate-700/70">
      {activeOrder ? (
        <section
          className="rounded-xl border border-amber-200/75 bg-amber-50/40 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/30 md:p-3"
          aria-labelledby="courier-current-delivery-heading"
        >
          <h4
            id="courier-current-delivery-heading"
            className="mb-2 text-xs font-semibold text-amber-950 dark:text-amber-100"
          >
            Current delivery
          </h4>
          <ul className="m-0 list-none space-y-0 p-0">
            <OpenDeliveryTaskRow
              o={activeOrder}
              listing={openListingsById[String(activeOrder.listingId)] ?? null}
              courierChrome={courierChrome}
              showAcceptButton={false}
              canClaimDeliveries={false}
              claimingId={null}
              topMeta={
                <>
                  {activeRunStatusNote(activeOrder.status) ? (
                    <p className="text-[11px] font-medium text-amber-900 dark:text-amber-50">
                      {activeRunStatusNote(activeOrder.status)}
                    </p>
                  ) : null}
                  {assignmentMode ? (
                    <p className="text-[10px] text-neutral-600 dark:text-slate-400">
                      Recorded transport:{" "}
                      <span className="font-semibold text-neutral-800 dark:text-slate-200">
                        {MODE_LABEL[assignmentMode] ?? assignmentMode}
                      </span>
                    </p>
                  ) : null}
                </>
              }
            />
          </ul>
        </section>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
          <h4 className="min-w-0 text-xs font-semibold text-violet-950 dark:text-violet-100">Open tasks</h4>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{headerTrailing}</div>
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-[11px] text-neutral-600 dark:text-slate-400">
            First to accept gets the run. Cash only at handoff (no wallet). Pool amounts are on each task.
          </p>
          {viewerSuggestedCompensationCents != null &&
          Number.isFinite(Number(viewerSuggestedCompensationCents)) &&
          Math.max(0, Number(viewerSuggestedCompensationCents)) > 0 ? (
            <p className="mt-1 text-[10px] text-neutral-600 dark:text-slate-400">
              Your suggested reference rate:{" "}
              <span className="font-semibold text-neutral-800 dark:text-slate-200">
                {formatCents(Math.max(0, Math.floor(Number(viewerSuggestedCompensationCents))))}
              </span>{" "}
              — informational only, not auto-charged.
            </p>
          ) : null}
          {activeOrder && invitations.length === 0 ? (
            <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
              You’re on a delivery — finish it before accepting another open task. Browse what’s waiting below.
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2 border-t border-neutral-200/80 pt-3 mt-3 dark:border-slate-700/70">
      {showInlineTransportPicker && modesLoaded && selectableModes.length > 0 ? (
        <div className="rounded-lg border border-violet-200/60 bg-violet-50/50 px-2.5 py-2 dark:border-violet-800/40 dark:bg-violet-950/30">
          <p className="text-[10px] font-medium text-neutral-700 dark:text-slate-300">Transport for this run</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Delivery transport mode">
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
                disabled={Boolean(claimingId) || !canClaimDeliveries}
                onClick={() => pickTransportMode(m)}
              >
                {MODE_LABEL[m] ?? m}
              </Button>
            ))}
          </div>
          {profileModes.length === 0 ? (
            <p className="mt-1.5 text-[10px] text-neutral-500 dark:text-slate-500">
              Tap a mode to save it on your profile — neighbors see it when suggesting you. Until then, any mode can be used when you claim.
            </p>
          ) : null}
        </div>
      ) : null}
      {invitations.length > 0 ? (
        <section className="mt-2 space-y-2" aria-labelledby="courier-invitations-heading">
          <h4 id="courier-invitations-heading" className="text-xs font-semibold text-violet-950 dark:text-violet-100">
            Suggested to you
          </h4>
          <ul className="space-y-2">
            {invitations.map((inv) => {
              const o = inv.order;
              if (!o || typeof o !== "object") return null;
              const oid = String(o.id || "");
              return (
                <OpenDeliveryTaskRow
                  key={String(inv.assignmentId || oid)}
                  o={o}
                  listing={openListingsById[String(o.listingId)] ?? null}
                  courierChrome={courierChrome}
                  showAcceptButton
                  canClaimDeliveries={canClaimDeliveries}
                  claimingId={claimingId}
                  onAccept={() => respondInvitation(oid)}
                  bottomMeta={<CourierInvitationNote invitedByBuyer={inv.invitedByBuyer} invitedBySeller={inv.invitedBySeller} />}
                />
              );
            })}
          </ul>
        </section>
      ) : null}
      {claimBanner ? (
        <p className="mt-2 rounded-lg border border-violet-200/70 bg-violet-50/90 px-2.5 py-2 text-[11px] text-violet-950 dark:border-violet-800/45 dark:bg-violet-950/40 dark:text-violet-100">
          {claimBanner}
        </p>
      ) : null}
      {error ? (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            className={cn("min-h-9 text-[11px]", courierChrome.recoverySecondary)}
            onClick={() => void load()}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {loading ? (
        <OpenDeliveriesSkeleton />
      ) : openTasksOrders.length === 0 && invitations.length === 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-neutral-800 dark:text-slate-200">Nothing open yet</p>
          <p className="text-[11px] leading-snug text-neutral-600 dark:text-slate-400">
            Tasks show after a seller accepts a delivery and any tip rules are met. Check back later.
          </p>
        </div>
      ) : openTasksOrders.length > 0 ? (
        <section
          className="mt-2 space-y-2"
          aria-labelledby={invitations.length > 0 ? "courier-open-pool-heading" : undefined}
        >
          {invitations.length > 0 ? (
            <h4
              id="courier-open-pool-heading"
              className="text-xs font-semibold text-violet-950 dark:text-violet-100"
            >
              Other open tasks
            </h4>
          ) : null}
          <ul className="m-0 list-none space-y-2 p-0">
            {openTasksOrders.map((o) => (
              <OpenDeliveryTaskRow
                key={String(o.id)}
                o={o}
                listing={openListingsById[String(o.listingId)] ?? null}
                courierChrome={courierChrome}
                showAcceptButton
                canClaimDeliveries={canClaimDeliveries}
                claimingId={claimingId}
                onAccept={() => claim(o.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}
      </div>
    </div>
  );
}
